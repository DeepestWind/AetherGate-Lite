from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from app.core.security import decrypt_secret
from app.models.endpoint import ModelEndpoint
from app.providers.base import (
    BaseProvider,
    ProviderCallError,
    ProviderChatResult,
    ProviderStreamEvent,
)
from app.schemas.chat import ChatMessage
from app.services.prompt_utils import normalize_message_content


class OpenAICompatibleProvider(BaseProvider):
    provider_type = "openai_compatible"

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
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }

    def _build_headers(self, endpoint: ModelEndpoint) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        secret = decrypt_secret(endpoint.encrypted_key)
        if secret:
            headers["Authorization"] = f"Bearer {secret}"
        return headers

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
        headers = self._build_headers(endpoint)

        async with self.build_client() as client:
            response = await client.post(
                f"{endpoint.base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers=headers,
            )
        if response.status_code >= 400:
            raise ProviderCallError(
                code=f"provider_http_{response.status_code}",
                message=response.text,
                status_code=response.status_code,
            )
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise ProviderCallError("provider_invalid_response", "Missing choices in provider response.")
        message = choices[0].get("message") or {}
        usage = data.get("usage") or {}
        prompt_tokens = int(usage.get("prompt_tokens") or 0)
        completion_tokens = int(usage.get("completion_tokens") or 0)
        total_tokens = int(usage.get("total_tokens") or prompt_tokens + completion_tokens)
        return ProviderChatResult(
            content=message.get("content") or "",
            finish_reason=choices[0].get("finish_reason") or "stop",
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
        headers = self._build_headers(endpoint)

        async with self.build_client() as client:
            async with client.stream(
                "POST",
                f"{endpoint.base_url.rstrip('/')}/chat/completions",
                json=payload,
                headers=headers,
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
                    if not line or not line.startswith("data:"):
                        continue
                    data_text = line[5:].strip()
                    if data_text == "[DONE]":
                        break
                    try:
                        data = json.loads(data_text)
                    except json.JSONDecodeError as exc:
                        raise ProviderCallError(
                            "provider_invalid_stream",
                            f"Invalid JSON chunk: {data_text}",
                        ) from exc

                    choices = data.get("choices") or []
                    choice = choices[0] if choices else {}
                    delta_payload = choice.get("delta") or {}
                    delta = delta_payload.get("content") or ""
                    usage = data.get("usage") or {}

                    yield ProviderStreamEvent(
                        delta=str(delta),
                        finish_reason=choice.get("finish_reason"),
                        prompt_tokens=int(usage.get("prompt_tokens") or 0) or None,
                        completion_tokens=int(usage.get("completion_tokens") or 0) or None,
                        total_tokens=int(usage.get("total_tokens") or 0) or None,
                        actual_model=data.get("model") or endpoint.model_name,
                    )

    async def validate_endpoint(self, endpoint: ModelEndpoint) -> tuple[bool, str]:
        headers = {}
        secret = decrypt_secret(endpoint.encrypted_key)
        if secret:
            headers["Authorization"] = f"Bearer {secret}"
        async with self.build_client() as client:
            response = await client.get(f"{endpoint.base_url.rstrip('/')}/models", headers=headers)
        if response.status_code >= 400:
            return False, response.text
        return True, "Endpoint is reachable."
