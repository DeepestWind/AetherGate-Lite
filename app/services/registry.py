from app.providers.base import BaseProvider
from app.providers.ollama import OllamaProvider
from app.providers.openai_compatible import OpenAICompatibleProvider


class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, BaseProvider] = {
            "openai_compatible": OpenAICompatibleProvider(),
            "ollama": OllamaProvider(),
        }

    def get(self, provider_type: str) -> BaseProvider:
        provider = self._providers.get(provider_type)
        if not provider:
            raise ValueError(f"Unsupported provider '{provider_type}'.")
        return provider

