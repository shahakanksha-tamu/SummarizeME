from typing import Literal
from pydantic import BaseModel, Field

# Request and Response Schemas for Text Summarization

# Request Schema
class SummaryRequest(BaseModel):
    text: str = Field(..., min_length=1)
    level: Literal["short", "medium", "long"] = Field(
        "medium",
        description="short | medium | long",
    )

# Response Schema
class SummaryResponse(BaseModel):
    ok: bool
    summary: str | None = None
    error: str | None = None

