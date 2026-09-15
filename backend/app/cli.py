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
    eval_cmd.add_argument("--format", choices=["text", "markdown", "junit"], default="text", help="Output reporting format")
    eval_cmd.add_argument("--output", default=None, help="Optional output file path")

    return parser.parse_args()

def generate_markdown_summary(run: EvaluationRun, threshold: float) -> str:
    status_icon = "PASSED" if run.pass_rate >= threshold else "FAILED"
    lines = [
        f"### EvalPulse CI/CD Evaluation Summary — {run.name}",
        "",
        f"**Status**: {status_icon} | **Pass Rate**: {run.pass_rate * 100:.1f}% (Required: {threshold * 100:.1f}%) | **Cost**: ${run.total_cost:.5f}",
        "",
        "| Test ID | Model | Score | Status | Latency | Cost |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ]
    for r in run.results:
        st = "Pass" if r.passed else "Fail"
        lines.append(
            f"| `{r.test_case_id}` | `{r.model}` | {int(r.composite_score * 100)}% | {st} | {round(r.latency_ms)} ms | ${r.estimated_cost:.5f} |"
        )
    return "\n".join(lines)

def generate_junit_xml(run: EvaluationRun) -> str:
    failures = sum(1 for r in run.results if not r.passed)
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<testsuite name="{run.name}" tests="{len(run.results)}" failures="{failures}" errors="0" time="{run.avg_latency_ms / 1000.0:.3f}">',
    ]
    for r in run.results:
        sec = r.latency_ms / 1000.0
        xml_lines.append(f'  <testcase classname="{r.model}" name="{r.test_case_id}" time="{sec:.3f}">')
        if not r.passed:
            xml_lines.append(f'    <failure message="Score {int(r.composite_score * 100)}% below threshold">')
            xml_lines.append(f'Output: {r.actual_output}')
            xml_lines.append('    </failure>')
        xml_lines.append('  </testcase>')
    xml_lines.append('</testsuite>')
    return "\n".join(xml_lines)

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
    completed_run = await runner.run_evaluation(run, dataset, metrics)

    report_content = ""
    if args.format == "markdown":
        report_content = generate_markdown_summary(completed_run, args.threshold)
        print(report_content)
    elif args.format == "junit":
        report_content = generate_junit_xml(completed_run)
        print(report_content)
    else:
        print("\n" + "=" * 50)
        print(f"EvalPulse Run Results: {completed_run.name}")
        print(f"Status: {completed_run.status}")
        print(f"Total Tests: {completed_run.total_tests}")
        print(f"Pass Rate: {completed_run.pass_rate * 100:.1f}% (Required: {args.threshold * 100:.1f}%)")
        print(f"Average Latency: {completed_run.avg_latency_ms} ms (p95: {completed_run.p95_latency_ms} ms)")
        print(f"Estimated Cost: ${completed_run.total_cost:.6f}")
        print("=" * 50)

    if args.output and report_content:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report_content)
        print(f"[INFO] Saved report to {args.output}")

    if completed_run.pass_rate < args.threshold:
        print(f"[FAILED] Pass rate {completed_run.pass_rate} is below target {args.threshold}!", file=sys.stderr)
        sys.exit(1)

    print("[PASSED] All evaluation quality and regression gates satisfied.")
    sys.exit(0)

if __name__ == "__main__":
    asyncio.run(run_cli())
