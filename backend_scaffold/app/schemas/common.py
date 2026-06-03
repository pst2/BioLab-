from typing import Any

from pydantic import BaseModel, Field


class MetaInfo(BaseModel):
    source: str = "internal"
    cached: bool = False
    stale: bool = False
    count: int | None = None


class ApiResponse(BaseModel):
    success: bool = True
    message: str
    data: Any = Field(default_factory=dict)
    meta: MetaInfo | None = None
