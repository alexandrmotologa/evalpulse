import pytest
from app.models.dataset import Dataset, TestCase
from app.models.evaluation import EvaluationRun, ScoringMetricConfig
from app.core.matrix_runner import MatrixRunner, render_prompt_template

def test_template_rendering():
    template = "Classify intent: {{subject}} from user {{user}}"
    data = {"subject": "Need refund", "user": "Alice"}
    result = render_prompt_template(template, data)
    assert result == "Classify intent: Need refund from user Alice"

@pytest.mark.asyncio
async def test_matrix_runner_execution():
    test_cases = [
        TestCase(
            id="tc-1",
            input_data={"subject": "Login failure"},
            expected_output='{"intent": "auth"}',
        ),
        TestCase(
            id="tc-2",
            input_data={"subject": "Billing issue"},
            expected_output='{"intent": "billing"}',
        ),
    ]
    dataset = Dataset(
        id="test-ds",
        name="Test Dataset",
        test_cases=test_cases,
    )

    run = EvaluationRun(
        name="Test Run",
        dataset_id=dataset.id,
        prompt_template="Analyze ticket: {{subject}}",
        models=["mock-gpt-4o", "mock-llama-3-8b"],
    )

    metrics = [
        ScoringMetricConfig(metric="semantic_similarity", weight=1.0, threshold=0.5),
    ]

    runner = MatrixRunner(max_concurrency=2)
    completed_run = await runner.run_evaluation(run, dataset, metrics)

    assert completed_run.status == "completed"
    assert completed_run.total_tests == 4
    assert completed_run.completed_tests == 4
    assert len(completed_run.results) == 4
    assert completed_run.avg_latency_ms > 0
