from __future__ import annotations

from datetime import datetime, date

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    database: str
    timestamp: datetime


class MetricsResponse(BaseModel):
    total_requests: int
    success_requests: int
    failed_requests: int
    cache_hits: int
    fallback_requests: int
    cache_hit_rate: float
    success_rate: float
    average_latency_ms: float
    total_tokens: int
    total_cost_usd: float
    model_distribution: dict[str, int]


class StatsPoint(BaseModel):
    date: date
    total_requests: int
    success_requests: int
    failed_requests: int
    cache_hits: int
    total_tokens: int
    total_cost_usd: float


class StatsResponse(BaseModel):
    days: int
    series: list[StatsPoint]


class LogItem(BaseModel):
    request_id: str
    endpoint_id: int | None
    endpoint_name: str | None = None
    logical_model: str
    provider: str | None
    actual_model: str | None
    total_tokens: int
    cost_usd: float
    latency_ms: int
    cache_hit: bool
    route_reason: str | None
    status: str
    error_code: str | None
    prompt_id: str | None
    fallback_count: int
    timestamp: datetime


class LogsResponse(BaseModel):
    total: int
    items: list[LogItem]
