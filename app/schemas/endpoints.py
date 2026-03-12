from __future__ import annotations

from datetime import datetime

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class EndpointBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider_type: Literal["openai_compatible", "ollama"]
    base_url: str
    model_name: str
    logical_model: str
    priority: int = 100
    input_cost_per_1k: float | None = None
    output_cost_per_1k: float | None = None
    quality_score: float = 0.0
    is_enabled: bool = True
    remark: str | None = None


class EndpointCreate(EndpointBase):
    api_key: str | None = None


class EndpointUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    provider_type: str | None = None
    base_url: str | None = None
    model_name: str | None = None
    logical_model: str | None = None
    priority: int | None = None
    input_cost_per_1k: float | None = None
    output_cost_per_1k: float | None = None
    quality_score: float | None = None
    is_enabled: bool | None = None
    remark: str | None = None
    api_key: str | None = None


class EndpointToggleRequest(BaseModel):
    is_enabled: bool


class EndpointResponse(EndpointBase, ORMModel):
    id: int
    masked_key: str | None = None
    is_valid: bool | None = None
    last_validated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class EndpointValidationResponse(BaseModel):
    endpoint_id: int
    is_valid: bool
    detail: str
    last_validated_at: datetime
