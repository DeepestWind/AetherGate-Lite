from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ChatStrategy = Literal["balanced"]
ChatMessageRole = Literal["assistant", "summary", "system", "tool", "user"]
ChatMessageStatus = Literal["completed", "error", "pending", "stopped"]
VisibleMessageKind = Literal["node", "summary"]


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


class ChatConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ChatConversationMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=32768)
    draft_config: ChatConversationConfig


class ChatConversationMessageNodeEdit(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    content: str = Field(min_length=1, max_length=32768)


class ChatConversationMessageCommitCreate(BaseModel):
    content: str = Field(min_length=1, max_length=32768)
    draft_config: ChatConversationConfig
    modified_nodes: list[ChatConversationMessageNodeEdit] = Field(default_factory=list)


class ChatConversationMessageRegenerateCreate(BaseModel):
    draft_config: ChatConversationConfig
    modified_nodes: list[ChatConversationMessageNodeEdit] = Field(default_factory=list)


class ChatConversationMessageBranchEditCreate(BaseModel):
    content: str = Field(min_length=1, max_length=32768)
    draft_config: ChatConversationConfig


class ChatConversationMessagePinUpdate(BaseModel):
    pinned: bool = False


class ChatConversationBranchCreate(BaseModel):
    base_message_id: str = Field(min_length=1, max_length=64)
    name: str | None = Field(default=None, max_length=80)


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
    status: Literal["cancelled", "error", "fallback", "success"]
    strategy: ChatStrategy
    total_tokens: int


class ChatMessageResponse(BaseModel):
    id: str
    role: ChatMessageRole
    content: str
    status: ChatMessageStatus
    timestamp: int
    parent_id: str | None = None
    modified_from: str | None = None
    pinned: bool = False
    archived: bool = False
    stale: bool = False
    call_info: ChatCallInfoResponse | None = None
    error_message: str | None = None


class VisibleMessageResponse(BaseModel):
    virtual_id: str
    kind: VisibleMessageKind
    role: ChatMessageRole
    content: str
    source_node_id: str | None = None
    source_node_ids: list[str] | None = None  # populated when kind="summary"
    timestamp: int | None = None


class ChatBranchResponse(BaseModel):
    id: str
    name: str
    head_message_id: str | None = None
    base_message_id: str | None = None


class ChatConversationSummaryResponse(BaseModel):
    id: str
    title: str
    draft_config: ChatConversationConfig
    last_message_at: int | None = None
    last_message_preview: str | None = None
    last_message_role: ChatMessageRole | None = None
    active_branch_id: str | None = None
    message_count: int
    created_at: int
    updated_at: int


class ChatConversationResponse(ChatConversationSummaryResponse):
    branches: list[ChatBranchResponse] = Field(default_factory=list)
    messages: list[ChatMessageResponse] = Field(default_factory=list)
    visible_messages: list[VisibleMessageResponse] = Field(default_factory=list)
    message_nodes: dict[str, ChatMessageResponse] = Field(default_factory=dict)
