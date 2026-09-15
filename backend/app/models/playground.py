from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.evaluation import ScoringMetricConfig, TestCaseResult

class PlaygroundRequest(BaseModel):
    prompt_template: str
    input_data: Dict[str, Any] = Field(default_factory=dict)
    models: List[str] = Field(default_factory=lambda: ["mock-gpt-4o"])
    system_prompt: Optional[str] = None
    temperature: float = 0.0
    expected_output: Optional[str] = None
    metrics: Optional[List[ScoringMetricConfig]] = None
    schema_definition: Optional[Dict[str, Any]] = None

class PlaygroundResponse(BaseModel):
    rendered_prompt: str
    results: List[TestCaseResult]
