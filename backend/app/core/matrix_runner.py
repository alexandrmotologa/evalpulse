import asyncio
import datetime
import re
from typing import List, Dict, Any, Optional, Callable
import numpy as np

from app.models.dataset import Dataset, TestCase
from app.models.evaluation import EvaluationRun, TestCaseResult, ScoringMetricConfig
from app.core.providers import execute_prompt
from app.core.scoring import evaluate_test_case
from app.core.pricing import calculate_cost

def render_prompt_template(template: str, input_data: Dict[str, Any]) -> str:
    """Replace {{variable}} or {variable} placeholders with values from input_data."""
    def replacer(match):
        key = match.group(1).strip()
        val = input_data.get(key, "")
        return str(val) if val is not None else ""

    rendered = re.sub(r"\{\{\s*(\w+)\s*\}\}", replacer, template)
    return rendered

class MatrixRunner:
    def __init__(self, max_concurrency: int = 5):
        self.semaphore = asyncio.Semaphore(max_concurrency)

    async def run_single_cell(
        self,
        test_case: TestCase,
        model: str,
        prompt_template: str,
        system_prompt: Optional[str],
        temperature: float,
        metrics: List[ScoringMetricConfig],
        schema_definition: Optional[Dict[str, Any]],
    ) -> TestCaseResult:
        async with self.semaphore:
            rendered_prompt = render_prompt_template(prompt_template, test_case.input_data)
            
            response = await execute_prompt(
                model=model,
                prompt=rendered_prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                expected_output=test_case.expected_output,
            )
            
            if response.error:
                return TestCaseResult(
                    test_case_id=test_case.id,
                    model=model,
                    actual_output="",
                    expected_output=test_case.expected_output,
                    scores={},
                    composite_score=0.0,
                    passed=False,
                    latency_ms=response.latency_ms,
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                    estimated_cost=0.0,
                    error=response.error,
                )

            metrics_dicts = [m.model_dump() for m in metrics]
            scores, composite, passed = evaluate_test_case(
                actual=response.output_text,
                expected=test_case.expected_output,
                metrics=metrics_dicts,
                schema_definition=schema_definition,
            )

            cost = calculate_cost(
                model=model,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
            )

            return TestCaseResult(
                test_case_id=test_case.id,
                model=model,
                actual_output=response.output_text,
                expected_output=test_case.expected_output,
                scores=scores,
                composite_score=composite,
                passed=passed,
                latency_ms=response.latency_ms,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                total_tokens=response.prompt_tokens + response.completion_tokens,
                estimated_cost=cost,
            )

    async def run_evaluation(
        self,
        run: EvaluationRun,
        dataset: Dataset,
        metrics: List[ScoringMetricConfig],
        temperature: float = 0.0,
        progress_callback: Optional[Callable[[Dict[str, Any]], Any]] = None,
    ) -> EvaluationRun:
        run.status = "running"
        total_cells = len(run.models) * len(dataset.test_cases)
        run.total_tests = total_cells
        run.completed_tests = 0
        run.results = []

        if progress_callback:
            await progress_callback({
                "type": "start",
                "run_id": run.id,
                "total": total_cells,
            })

        tasks = []
        for model in run.models:
            for tc in dataset.test_cases:
                tasks.append(
                    self.run_single_cell(
                        test_case=tc,
                        model=model,
                        prompt_template=run.prompt_template,
                        system_prompt=run.system_prompt,
                        temperature=temperature,
                        metrics=metrics,
                        schema_definition=dataset.schema_definition,
                    )
                )

        completed_results: List[TestCaseResult] = []
        for future in asyncio.as_completed(tasks):
            res = await future
            completed_results.append(res)
            run.completed_tests += 1

            if progress_callback:
                await progress_callback({
                    "type": "progress",
                    "run_id": run.id,
                    "completed": run.completed_tests,
                    "total": total_cells,
                    "latest_result": res.model_dump(),
                })

        run.results = completed_results
        run.status = "completed"
        run.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Calculate aggregates
        latencies = [r.latency_ms for r in run.results if r.latency_ms > 0]
        passed_count = sum(1 for r in run.results if r.passed)
        total_cost = sum(r.estimated_cost for r in run.results)
        total_tokens = sum(r.total_tokens for r in run.results)

        run.pass_rate = round(passed_count / len(run.results), 4) if run.results else 0.0
        run.avg_latency_ms = round(float(np.mean(latencies)), 2) if latencies else 0.0
        run.p50_latency_ms = round(float(np.percentile(latencies, 50)), 2) if latencies else 0.0
        run.p95_latency_ms = round(float(np.percentile(latencies, 95)), 2) if latencies else 0.0
        run.total_cost = round(total_cost, 6)
        run.total_tokens = total_tokens

        if progress_callback:
            await progress_callback({
                "type": "complete",
                "run_id": run.id,
                "run": run.model_dump(),
            })

        return run
