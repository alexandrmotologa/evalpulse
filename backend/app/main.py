import asyncio
import csv
import io
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.config import SAMPLE_DATA_DIR
from app.models.dataset import Dataset, DatasetCreateRequest, TestCase
from app.models.evaluation import RunRequest, EvaluationRun, RunComparison, ScoringMetricConfig, TestCaseResult
from app.models.playground import PlaygroundRequest, PlaygroundResponse
from app.core.pricing import get_supported_models, calculate_cost
from app.core.matrix_runner import MatrixRunner, render_prompt_template
from app.core.providers import check_ollama_status, execute_prompt
from app.core.scoring import evaluate_test_case
from app.core.report import generate_html_report
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
    version="0.2.0",
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
        "version": "0.2.0",
    }

@app.get("/api/providers/ollama")
async def get_ollama_status():
    """Check Ollama availability and discover local models."""
    return await check_ollama_status()

@app.get("/api/models")
async def get_models():
    """Return configured models plus any locally discovered Ollama models."""
    models = get_supported_models()
    ollama_info = await check_ollama_status()
    if ollama_info.get("online"):
        for m in ollama_info.get("models", []):
            models.append({
                "id": f"ollama/{m}",
                "name": f"Ollama: {m}",
                "provider": "Ollama (Local)",
                "inputPricePerM": 0.0,
                "outputPricePerM": 0.0,
                "isMock": False,
            })
    return {"models": models, "ollama_online": ollama_info.get("online", False)}

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

@app.post("/api/datasets/import", response_model=Dataset)
def import_dataset(payload: dict):
    """Import dataset from raw JSONL, CSV or JSON text."""
    format_type = payload.get("format", "json").lower()
    content = payload.get("content", "").strip()
    name = payload.get("name", "Imported Dataset")
    description = payload.get("description", "Imported via studio uploader")
    
    if not content:
        raise HTTPException(status_code=400, detail="Content payload cannot be empty")

    test_cases: List[TestCase] = []

    try:
        if format_type == "jsonl":
            for line in content.splitlines():
                line = line.strip()
                if line:
                    item = json.loads(line)
                    test_cases.append(
                        TestCase(
                            input_data=item.get("input_data", item.get("inputs", item)),
                            expected_output=item.get("expected_output", item.get("output")),
                            metadata=item.get("metadata", {}),
                        )
                    )
        elif format_type == "csv":
            reader = csv.DictReader(io.StringIO(content))
            for idx, row in enumerate(reader):
                expected = row.pop("expected_output", row.pop("output", None))
                test_cases.append(
                    TestCase(
                        id=f"row-{idx+1}",
                        input_data=row,
                        expected_output=expected,
                    )
                )
        else:
            # JSON format
            raw = json.loads(content)
            if isinstance(raw, list):
                for item in raw:
                    test_cases.append(TestCase(**item))
            elif isinstance(raw, dict) and "test_cases" in raw:
                test_cases = [TestCase(**tc) for tc in raw["test_cases"]]
                name = raw.get("name", name)
                description = raw.get("description", description)
            else:
                raise ValueError("Unrecognized JSON dataset structure")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse {format_type.upper()} dataset: {str(e)}")

    dataset = Dataset(
        name=name,
        description=description,
        test_cases=test_cases,
    )
    save_dataset(dataset)
    return dataset

@app.get("/api/datasets/{dataset_id}/export")
def export_dataset(dataset_id: str, format: str = Query("json", pattern="^(json|jsonl|csv)$")):
    """Export dataset in JSON, JSONL, or CSV format."""
    ds = get_dataset(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if format == "jsonl":
        lines = [json.dumps(tc.model_dump()) for tc in ds.test_cases]
        return PlainTextResponse(
            "\n".join(lines),
            media_type="application/x-ndjson",
            headers={"Content-Disposition": f"attachment; filename={ds.id}.jsonl"},
        )
    elif format == "csv":
        if not ds.test_cases:
            return PlainTextResponse("", media_type="text/csv")
        
        # Flatten keys
        first_input = ds.test_cases[0].input_data
        fieldnames = ["id", "expected_output"] + list(first_input.keys())
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for tc in ds.test_cases:
            row = {"id": tc.id, "expected_output": tc.expected_output or ""}
            row.update(tc.input_data)
            writer.writerow(row)
        return PlainTextResponse(
            output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={ds.id}.csv"},
        )

    # Standard JSON export
    return PlainTextResponse(
        json.dumps(ds.model_dump(), indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={ds.id}.json"},
    )

@app.post("/api/playground/run", response_model=PlaygroundResponse)
async def run_playground(payload: PlaygroundRequest):
    """Execute single prompt sandbox test across selected models with live scoring."""
    rendered_prompt = render_prompt_template(payload.prompt_template, payload.input_data)
    
    metrics = payload.metrics or [
        ScoringMetricConfig(metric="semantic_similarity", weight=1.0, threshold=0.75),
        ScoringMetricConfig(metric="levenshtein", weight=0.5, threshold=0.60),
    ]
    if payload.schema_definition:
        metrics.append(ScoringMetricConfig(metric="json_schema", weight=1.5, threshold=1.0))

    results: List[TestCaseResult] = []

    for model in payload.models:
        resp = await execute_prompt(
            model=model,
            prompt=rendered_prompt,
            system_prompt=payload.system_prompt,
            temperature=payload.temperature,
            expected_output=payload.expected_output,
        )

        metrics_dicts = [m.model_dump() for m in metrics]
        scores, composite, passed = evaluate_test_case(
            actual=resp.output_text,
            expected=payload.expected_output,
            metrics=metrics_dicts,
            schema_definition=payload.schema_definition,
        )

        cost = calculate_cost(
            model=model,
            prompt_tokens=resp.prompt_tokens,
            completion_tokens=resp.completion_tokens,
        )

        results.append(
            TestCaseResult(
                test_case_id="sandbox-sample",
                model=model,
                actual_output=resp.output_text,
                expected_output=payload.expected_output,
                scores=scores,
                composite_score=composite,
                passed=passed,
                latency_ms=resp.latency_ms,
                prompt_tokens=resp.prompt_tokens,
                completion_tokens=resp.completion_tokens,
                total_tokens=resp.prompt_tokens + resp.completion_tokens,
                estimated_cost=cost,
                error=resp.error,
            )
        )

    return PlaygroundResponse(
        rendered_prompt=rendered_prompt,
        results=results,
    )

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

@app.get("/api/runs/{run_id}/report", response_class=HTMLResponse)
def get_run_report_html(run_id: str):
    """Serve a self-contained standalone HTML report for this run."""
    run = get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return HTMLResponse(content=generate_html_report(run))

@app.post("/api/runs", response_model=EvaluationRun)
async def create_evaluation_run(payload: RunRequest, background_tasks: BackgroundTasks):
    dataset = get_dataset(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {payload.dataset_id} not found")

    metrics = payload.metrics
    if not metrics:
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
    queue = asyncio.Queue()
    if run_id not in RUN_EVENT_QUEUES:
        RUN_EVENT_QUEUES[run_id] = []
    RUN_EVENT_QUEUES[run_id].append(queue)

    async def event_generator():
        try:
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
