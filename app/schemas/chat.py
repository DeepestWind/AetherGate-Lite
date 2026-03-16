from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageContentPart(BaseModel):
    type: str = "text"
    text: str | None = None


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str | list[ChatMessageContentPart] | None = None


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str
    messages: list[ChatMessage]
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1, le=65536)
    prompt_id: str | None = None
    prompt_variables: dict[str, Any] = Field(default_factory=dict)
    strategy: Literal["designated", "balanced", "cheapest", "quality"] | None = None
    endpoint_id: int | None = None
    disable_cache: bool = False
    stream: bool = False


class ChatChoiceMessage(BaseModel):
    role: str = "assistant"
    content: str


class ChatChoice(BaseModel):
    index: int = 0
    message: ChatChoiceMessage
    finish_reason: str = "stop"


class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatChoice]
    usage: UsageInfo


class ModelDescriptor(BaseModel):
    id: str
    object: str = "model"
    created: int = 0
    owned_by: str = "aethergate-lite"


class ModelsResponse(BaseModel):
    object: str = "list"
    data: list[ModelDescriptor]
