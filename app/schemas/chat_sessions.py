from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ChatStrategy = Literal["balanced", "cheapest", "quality"]
ChatMessageRole = Literal["assistant", "system", "tool", "user"]
ChatMessageStatus = Literal["completed", "error", "pending"]


class ChatConversationConfig(BaseModel):
    model: str = ""
    prompt_id: str = ""
    strategy: ChatStrategy = "balanced"
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    variables: dict[str, str] = Field(default_factory=dict)


class ChatConversationCreate(BaseModel):
    draft_config: ChatConversationConfig = Field(default_factory=ChatConversationConfig)


class ChatConversationUpdate(BaseModel):
    draft_config: ChatConversationConfig


class ChatConversationMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    draft_config: ChatConversationConfig


class ChatCallInfoResponse(BaseModel):
    cache_hit: bool
    completion_tokens: int
    cost_usd: float
    endpoint_id: str
    fallback_count: int
    latency_ms: int
    model: str
    prompt_tokens: int
    provider: str
    request_id: str
    route_reason: str
    status: Literal["error", "fallback", "success"]
    strategy: ChatStrategy
    total_tokens: int


class ChatMessageResponse(BaseModel):
    id: str
    role: ChatMessageRole
    content: str
    status: ChatMessageStatus
    timestamp: int
    call_info: ChatCallInfoResponse | None = None
    error_message: str | None = None


class ChatConversationSummaryResponse(BaseModel):
    id: str
    title: str
    draft_config: ChatConversationConfig
    last_message_at: int | None = None
    last_message_preview: str | None = None
    last_message_role: ChatMessageRole | None = None
    message_count: int
    created_at: int
    updated_at: int


class ChatConversationResponse(ChatConversationSummaryResponse):
    messages: list[ChatMessageResponse] = Field(default_factory=list)
