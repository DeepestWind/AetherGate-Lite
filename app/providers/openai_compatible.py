from __future__ import annotations

from app.core.security import decrypt_secret
from app.models.endpoint import ModelEndpoint
from app.providers.base import BaseProvider, ProviderCallError, ProviderChatResult
from app.schemas.chat import ChatMessage
from app.services.prompt_utils import normalize_message_content


class OpenAICompatibleProvider(BaseProvider):
    provider_type = "openai_compatible"

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
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
        headers = {"Content-Type": "application/json"}
        secret = decrypt_secret(endpoint.encrypted_key)
        if secret:
            headers["Authorization"] = f"Bearer {secret}"

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

