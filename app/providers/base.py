from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.models.endpoint import ModelEndpoint
from app.schemas.chat import ChatMessage


class ProviderCallError(Exception):
    def __init__(self, code: str, message: str, status_code: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(slots=True)
class ProviderChatResult:
    content: str
    finish_reason: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    actual_model: str


class BaseProvider:
    provider_type: str

    async def chat_completions(
        self,
        endpoint: ModelEndpoint,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
    ) -> ProviderChatResult:
        raise NotImplementedError

    async def validate_endpoint(self, endpoint: ModelEndpoint) -> tuple[bool, str]:
        raise NotImplementedError

    def build_client(self) -> httpx.AsyncClient:
        settings = get_settings()
        return httpx.AsyncClient(timeout=settings.request_timeout_seconds)

