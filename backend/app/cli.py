import argparse
import asyncio
import sys
from app.storage.db import init_db, get_dataset
from app.models.evaluation import EvaluationRun, ScoringMetricConfig
from app.core.matrix_runner import MatrixRunner
from app.config import SAMPLE_DATA_DIR
from app.main import seed_sample_datasets

def parse_args():
    parser = argparse.ArgumentParser(description="EvalPulse Command-Line Evaluator for CI/CD")
    subparsers = parser.add_subparsers(dest="command", required=True)

    eval_cmd = subparsers.add_parser("eval", help="Execute an evaluation matrix and check threshold")
    eval_cmd.add_argument("--dataset", required=True, help="Dataset ID (e.g., triage-v1)")
    eval_cmd.add_argument("--models", default="mock-gpt-4o", help="Comma-separated model names")
    eval_cmd.add_argument("--threshold", type=float, default=0.75, help="Minimum pass rate required (0.0 - 1.0)")
    eval_cmd.add_argument("--template", default="Triage ticket: {{ticket_subject}}\n{{ticket_body}}", help="Prompt template")
    eval_cmd.add_argument("--concurrency", type=int, default=5, help="Max concurrent requests")

    return parser.parse_args()

async def run_cli():
    args = parse_args()
    init_db()
    seed_sample_datasets()

    dataset = get_dataset(args.dataset)
    if not dataset:
        print(f"[ERROR] Dataset '{args.dataset}' not found.", file=sys.stderr)
        sys.exit(2)

    model_list = [m.strip() for m in args.models.split(",") if m.strip()]
    metrics = [
        ScoringMetricConfig(metric="semantic_similarity", weight=1.0, threshold=0.70),
        ScoringMetricConfig(metric="levenshtein", weight=0.5, threshold=0.60),
    ]
    if dataset.schema_definition:
        metrics.append(ScoringMetricConfig(metric="json_schema", weight=1.5, threshold=1.0))

    run = EvaluationRun(
        name=f"CI/CD Run - {dataset.name}",
        dataset_id=dataset.id,
        prompt_template=args.template,
        models=model_list,
        status="running",
    )

    runner = MatrixRunner(max_concurrency=args.concurrency)
    print(f"[INFO] Starting evaluation: dataset={dataset.name}, models={model_list}, threshold={args.threshold}")
    completed_run = await runner.run_evaluation(run, dataset, metrics)

    print("\n" + "=" * 50)
    print(f"EvalPulse Run Results: {completed_run.name}")
    print(f"Status: {completed_run.status}")
    print(f"Total Tests: {completed_run.total_tests}")
    print(f"Pass Rate: {completed_run.pass_rate * 100:.1f}% (Required: {args.threshold * 100:.1f}%)")
    print(f"Average Latency: {completed_run.avg_latency_ms} ms (p95: {completed_run.p95_latency_ms} ms)")
    print(f"Estimated Cost: ${completed_run.total_cost:.6f}")
    print("=" * 50)

    if completed_run.pass_rate < args.threshold:
        print(f"[FAILED] Pass rate {completed_run.pass_rate} is below target {args.threshold}!", file=sys.stderr)
        sys.exit(1)

    print("[PASSED] All evaluation quality and regression gates satisfied.")
    sys.exit(0)

if __name__ == "__main__":
    asyncio.run(run_cli())
