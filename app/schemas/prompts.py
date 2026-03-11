from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class PromptBase(BaseModel):
    prompt_id: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    content: str
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True


class PromptCreate(PromptBase):
    pass


class PromptUpdate(BaseModel):
    prompt_id: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    content: str | None = None
    variables: list[str] | None = None
    is_active: bool | None = None


class PromptPreviewRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)


class PromptResponse(PromptBase, ORMModel):
    id: int
    use_count: int
    created_at: datetime
    updated_at: datetime


class PromptPreviewResponse(BaseModel):
    prompt_id: str
    rendered: str

