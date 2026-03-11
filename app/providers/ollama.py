from __future__ import annotations

from app.models.endpoint import ModelEndpoint
from app.providers.base import BaseProvider, ProviderCallError, ProviderChatResult
from app.schemas.chat import ChatMessage
from app.services.prompt_utils import normalize_message_content


class OllamaProvider(BaseProvider):
    provider_type = "ollama"

    async def chat_completions(
        self,
        endpoint: ModelEndpoint,
        messages: list[ChatMessage],
        temperature: float,
        max_tokens: int,
    ) -> ProviderChatResult:
        payload = {
            "model": endpoint.model_name,
            "messages": [
                {"role": message.role, "content": normalize_message_content(message.content)}
                for message in messages
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
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

    async def validate_endpoint(self, endpoint: ModelEndpoint) -> tuple[bool, str]:
        async with self.build_client() as client:
            response = await client.get(f"{endpoint.base_url.rstrip('/')}/api/tags")
        if response.status_code >= 400:
            return False, response.text
        return True, "Endpoint is reachable."

