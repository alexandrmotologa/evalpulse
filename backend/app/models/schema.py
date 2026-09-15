from typing import Any, Optional
from pydantic import BaseModel, Field

class SchemaValidationResult(BaseModel):
    is_valid: bool
    errors: list[str] = Field(default_factory=list)
    parsed_json: Optional[Any] = None
