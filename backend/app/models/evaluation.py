from typing import Any, Optional
from pydantic import BaseModel, Field
import uuid
import datetime

class ScoringMetricConfig(BaseModel):
    metric: str
    weight: float = 1.0
    threshold: float = 0.8
    params: dict[str, Any] = Field(default_factory=dict)

class RunRequest(BaseModel):
    name: Optional[str] = None
    dataset_id: str
    prompt_template: str
    system_prompt: Optional[str] = None
    models: list[str]
    metrics: list[ScoringMetricConfig] = Field(default_factory=list)
    temperature: float = 0.0
    max_concurrency: int = 5

class TestCaseResult(BaseModel):
    test_case_id: str
    model: str
    actual_output: str
    expected_output: Optional[str] = None
    scores: dict[str, float] = Field(default_factory=dict)
    composite_score: float = 0.0
    passed: bool = False
    latency_ms: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost: float = 0.0
    error: Optional[str] = None

class EvaluationRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    dataset_id: str
    prompt_template: str
    system_prompt: Optional[str] = None
    models: list[str]
    status: str = "pending"
    total_tests: int = 0
    completed_tests: int = 0
    pass_rate: float = 0.0
    avg_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    total_cost: float = 0.0
    total_tokens: int = 0
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    completed_at: Optional[str] = None
    results: list[TestCaseResult] = Field(default_factory=list)

class DiffItem(BaseModel):
    test_case_id: str
    model: str
    base_output: str
    candidate_output: str
    expected_output: Optional[str] = None
    base_score: float
    candidate_score: float
    score_delta: float
    base_latency_ms: float
    candidate_latency_ms: float
    base_cost: float
    candidate_cost: float
    status: str

class RunComparison(BaseModel):
    base_run_id: str
    candidate_run_id: str
    base_run_name: str
    candidate_run_name: str
    pass_rate_delta: float
    latency_p95_delta_ms: float
    cost_delta: float
    regressions_count: int
    improvements_count: int
    unchanged_count: int
    diff_items: list[DiffItem] = Field(default_factory=list)
