from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from app.models.endpoint import ModelEndpoint
from app.providers.base import (
    BaseProvider,
    ProviderCallError,
    ProviderChatResult,
    ProviderStreamEvent,
)
from app.schemas.chat import ChatMessage
from app.services.prompt_utils import normalize_message_content


class OllamaProvider(BaseProvider):
    provider_type = "ollama"

    def _build_payload(
        self,
        endpoint: ModelEndpoint,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
        *,
        stream: bool,
    ) -> dict[str, object]:
        return {
            "model": endpoint.model_name,
            "messages": [
                {"role": message.role, "content": normalize_message_content(message.content)}
                for message in messages
            ],
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

    async def chat_completions(
        self,
        endpoint: ModelEndpoint,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
    ) -> ProviderChatResult:
        payload = self._build_payload(
            endpoint,
            messages,
            temperature,
            max_tokens,
            stream=False,
        )
        async with self.build_client() as client:
            response = await client.post(f"{endpoint.base_url.rstrip('/')}/api/chat", json=payload)
        if response.status_code >= 400:
            raise ProviderCallError(
                code=f"provider_http_{response.status_code}",
                message=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        message = data.get("message") or {}
        prompt_tokens = int(data.get("prompt_eval_count") or 0)
        completion_tokens = int(data.get("eval_count") or 0)
        total_tokens = prompt_tokens + completion_tokens
        return ProviderChatResult(
            content=message.get("content") or "",
            finish_reason="stop" if data.get("done", True) else "length",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            actual_model=data.get("model") or endpoint.model_name,
        )

    async def stream_chat_completions(
        self,
        endpoint: ModelEndpoint,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
        cancel_event: asyncio.Event | None = None,
    ) -> AsyncIterator[ProviderStreamEvent]:
        payload = self._build_payload(
            endpoint,
            messages,
            temperature,
            max_tokens,
            stream=True,
        )
        async with self.build_client() as client:
            async with client.stream(
                "POST",
                f"{endpoint.base_url.rstrip('/')}/api/chat",
                json=payload,
            ) as response:
                if response.status_code >= 400:
                    raise ProviderCallError(
                        code=f"provider_http_{response.status_code}",
                        message=(await response.aread()).decode("utf-8", errors="ignore"),
                        status_code=response.status_code,
                    )

                async for raw_line in response.aiter_lines():
                    if cancel_event and cancel_event.is_set():
                        break
                    line = raw_line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise ProviderCallError(
                            "provider_invalid_stream",
                            f"Invalid JSON chunk: {line}",
                        ) from exc

                    message = data.get("message") or {}
                    delta = message.get("content") or ""
                    prompt_tokens = int(data.get("prompt_eval_count") or 0) or None
                    completion_tokens = int(data.get("eval_count") or 0) or None
                    total_tokens = None
                    if prompt_tokens is not None or completion_tokens is not None:
                        total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)

                    yield ProviderStreamEvent(
                        delta=str(delta),
                        finish_reason="stop" if data.get("done", False) else None,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=total_tokens,
                        actual_model=data.get("model") or endpoint.model_name,
                    )

    async def validate_endpoint(self, endpoint: ModelEndpoint) -> tuple[bool, str]:
        async with self.build_client() as client:
            response = await client.get(f"{endpoint.base_url.rstrip('/')}/api/tags")
        if response.status_code >= 400:
            return False, response.text
        return True, "Endpoint is reachable."
