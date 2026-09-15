from typing import Any, Optional
from pydantic import BaseModel, Field
import uuid
import datetime

class TestCase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    input_data: dict[str, Any]
    expected_output: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class Dataset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    description: str = ""
    schema_definition: Optional[dict[str, Any]] = None
    test_cases: list[TestCase] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    version: int = 1

class DatasetCreateRequest(BaseModel):
    name: str
    description: str = ""
    schema_definition: Optional[dict[str, Any]] = None
    test_cases: list[TestCase]
