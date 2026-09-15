import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.config import SAMPLE_DATA_DIR
from app.models.dataset import Dataset, DatasetCreateRequest
from app.models.evaluation import RunRequest, EvaluationRun, RunComparison, ScoringMetricConfig
from app.core.pricing import get_supported_models
from app.core.matrix_runner import MatrixRunner
from app.storage.db import (
    init_db,
    save_dataset,
    get_dataset,
    list_datasets,
    save_run,
    get_run,
    list_runs,
    compare_runs,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("evalpulse")

# In-memory pub/sub for SSE streams
RUN_EVENT_QUEUES: Dict[str, List[asyncio.Queue]] = {}

def seed_sample_datasets():
    """Load default golden datasets into SQLite if empty."""
    for filename in ["triage_dataset.json", "extraction_dataset.json"]:
        file_path = SAMPLE_DATA_DIR / filename
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    dataset = Dataset(**data)
                    save_dataset(dataset)
                    logger.info(f"Loaded sample dataset: {dataset.name} ({dataset.id})")
            except Exception as e:
                logger.error(f"Failed to seed {filename}: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_sample_datasets()
    yield

app = FastAPI(
    title="EvalPulse API",
    description="LLM Evaluation & Regression Engine",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def broadcast_run_event(run_id: str, event_data: dict):
    queues = RUN_EVENT_QUEUES.get(run_id, [])
    for q in queues:
        await q.put(event_data)

async def execute_run_task(run: EvaluationRun, dataset: Dataset, metrics: List[ScoringMetricConfig], temperature: float, concurrency: int):
    runner = MatrixRunner(max_concurrency=concurrency)

    async def on_progress(event):
        await broadcast_run_event(run.id, event)

    try:
        completed_run = await runner.run_evaluation(
            run=run,
            dataset=dataset,
            metrics=metrics,
            temperature=temperature,
            progress_callback=on_progress,
        )
        save_run(completed_run)
    except Exception as e:
        logger.error(f"Evaluation run {run.id} failed: {e}")
        run.status = "failed"
        save_run(run)
        await broadcast_run_event(run.id, {"type": "error", "message": str(e)})

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "EvalPulse Engine",
        "version": "0.1.0",
    }

@app.get("/api/models")
def get_models():
    return {"models": get_supported_models()}

@app.get("/api/datasets", response_model=List[Dataset])
def get_all_datasets():
    return list_datasets()

@app.get("/api/datasets/{dataset_id}", response_model=Dataset)
def get_single_dataset(dataset_id: str):
    ds = get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds

@app.post("/api/datasets", response_model=Dataset)
def create_dataset(payload: DatasetCreateRequest):
    dataset = Dataset(
        name=payload.name,
        description=payload.description,
        schema_definition=payload.schema_definition,
        test_cases=payload.test_cases,
    )
    save_dataset(dataset)
    return dataset

@app.get("/api/runs", response_model=List[EvaluationRun])
def get_all_runs(limit: int = Query(50, ge=1, le=200)):
    return list_runs(limit=limit)

@app.get("/api/runs/compare", response_model=RunComparison)
def compare_evaluation_runs(
    base_run_id: str = Query(..., description="Base reference run ID"),
    candidate_run_id: str = Query(..., description="Candidate run ID to compare"),
):
    comparison = compare_runs(base_run_id, candidate_run_id)
    if not comparison:
        raise HTTPException(status_code=404, detail="One or both evaluation runs not found")
    return comparison

@app.get("/api/runs/{run_id}", response_model=EvaluationRun)
def get_single_run(run_id: str):
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run

@app.post("/api/runs", response_model=EvaluationRun)
async def create_evaluation_run(payload: RunRequest, background_tasks: BackgroundTasks):
    dataset = get_dataset(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {payload.dataset_id} not found")

    metrics = payload.metrics
    if not metrics:
        # Default metric set
        metrics = [
            ScoringMetricConfig(metric="semantic_similarity", weight=1.0, threshold=0.75),
            ScoringMetricConfig(metric="levenshtein", weight=0.5, threshold=0.60),
        ]
        if dataset.schema_definition:
            metrics.append(ScoringMetricConfig(metric="json_schema", weight=1.5, threshold=1.0))

    run_name = payload.name or f"Eval - {dataset.name}"
    run = EvaluationRun(
        name=run_name,
        dataset_id=dataset.id,
        prompt_template=payload.prompt_template,
        system_prompt=payload.system_prompt,
        models=payload.models,
        status="pending",
        total_tests=len(payload.models) * len(dataset.test_cases),
    )
    save_run(run)

    background_tasks.add_task(
        execute_run_task,
        run=run,
        dataset=dataset,
        metrics=metrics,
        temperature=payload.temperature,
        concurrency=payload.max_concurrency,
    )

    return run

@app.get("/api/runs/{run_id}/stream")
async def stream_run_progress(run_id: str):
    """Server-Sent Events streaming endpoint for matrix evaluation progress."""
    queue = asyncio.Queue()
    if run_id not in RUN_EVENT_QUEUES:
        RUN_EVENT_QUEUES[run_id] = []
    RUN_EVENT_QUEUES[run_id].append(queue)

    async def event_generator():
        try:
            # Send initial run state if already exists
            existing_run = get_run(run_id)
            if existing_run:
                yield {
                    "event": "state",
                    "data": json.dumps(existing_run.model_dump()),
                }
                if existing_run.status in ["completed", "failed"]:
                    return

            while True:
                data = await queue.get()
                event_type = data.get("type", "update")
                yield {
                    "event": event_type,
                    "data": json.dumps(data),
                }
                if event_type in ["complete", "error"]:
                    break
        finally:
            if run_id in RUN_EVENT_QUEUES and queue in RUN_EVENT_QUEUES[run_id]:
                RUN_EVENT_QUEUES[run_id].remove(queue)
                if not RUN_EVENT_QUEUES[run_id]:
                    del RUN_EVENT_QUEUES[run_id]

    return EventSourceResponse(event_generator())
