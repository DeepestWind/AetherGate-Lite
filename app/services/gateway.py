from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.request_log import RequestLog
from app.providers.base import ProviderCallError
from app.repositories.endpoints import EndpointRepository
from app.repositories.request_logs import RequestLogRepository
from app.schemas.chat import (
    ChatChoice,
    ChatChoiceMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    UsageInfo,
)
from app.services.cache import TTLCache
from app.services.endpoint_state import EndpointStateTracker
from app.services.prompt_utils import approximate_tokens, messages_cache_blob
from app.services.prompts import PromptService
from app.services.registry import ProviderRegistry
from app.services.routing import RoutingService


@dataclass(slots=True)
class GatewayResult:
    response: ChatCompletionResponse
    headers: dict[str, str]
    request_log_id: int | None = None


class GatewayService:
    def __init__(self):
        settings = get_settings()
        self.settings = settings
        self.cache = TTLCache(settings.cache_ttl_seconds)
        self.state_tracker = EndpointStateTracker(
            threshold=settings.failure_threshold,
            cooldown_seconds=settings.failure_cooldown_seconds,
        )
        self.routing = RoutingService(self.state_tracker)
        self.prompts = PromptService()
        self.providers = ProviderRegistry()
        self.endpoint_repository = EndpointRepository()
        self.request_log_repository = RequestLogRepository()

    async def handle_chat(self, db: Session, request: ChatCompletionRequest) -> GatewayResult:
        if request.stream:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Streaming is not supported in V1.",
            )

        request_id = uuid4().hex
        strategy = request.strategy or self.settings.default_strategy
        temperature = (
            request.temperature if request.temperature is not None else self.settings.default_temperature
        )
        max_tokens = request.max_tokens or self.settings.default_max_tokens

        try:
            messages, prompt_template = self.prompts.apply_template(
                db,
                request.messages,
                request.prompt_id,
                request.prompt_variables,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
                headers={"X-Request-ID": request_id},
            ) from exc

        prompt_id = prompt_template.prompt_id if prompt_template else request.prompt_id
        cache_key = self._build_cache_key(messages, request, strategy, temperature, prompt_id)
        cache_enabled = not request.disable_cache and temperature <= self.settings.cache_temperature_threshold
        if cache_enabled:
            cached = self.cache.get(cache_key)
            if cached:
                response = ChatCompletionResponse.model_validate(cached["response"])
                request_log = self._persist_log(
                    db,
                    RequestLog(
                        request_id=request_id,
                        endpoint_id=cached.get("endpoint_id"),
                        logical_model=request.model,
                        provider=cached.get("provider"),
                        actual_model=response.model,
                        prompt_tokens=response.usage.prompt_tokens,
                        completion_tokens=response.usage.completion_tokens,
                        total_tokens=response.usage.total_tokens,
                        cost_usd=0.0,
                        latency_ms=0,
                        cache_hit=True,
                        route_reason=f"{cached.get('route_reason', 'cache')}#cache",
                        status="success",
                        error_code=None,
                        prompt_id=prompt_id,
                        fallback_count=0,
                        timestamp=datetime.now(timezone.utc),
                    ),
                )
                headers = {
                    "X-Request-ID": request_id,
                    "X-AetherGate-Cache": "hit",
                    "X-AetherGate-Endpoint": str(cached.get("endpoint_id") or ""),
                    "X-AetherGate-Provider": str(cached.get("provider") or ""),
                    "X-AetherGate-Fallbacks": "0",
                    "X-AetherGate-Route-Reason": cached.get("route_reason", "cache"),
                }
                return GatewayResult(
                    response=response,
                    headers=headers,
                    request_log_id=request_log.id if request_log else None,
                )

        try:
            candidates, route_reason = self.routing.choose_candidates(
                db,
                request.model,
                strategy,
                request.endpoint_id,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
                headers={"X-Request-ID": request_id},
            ) from exc
        if not candidates:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No enabled endpoint found for logical model '{request.model}'.",
                headers={"X-Request-ID": request_id},
            )

        errors: list[str] = []
        for index, endpoint in enumerate(candidates):
            provider = self.providers.get(endpoint.provider_type)
            started_at = time.perf_counter()
            try:
                result = await provider.chat_completions(
                    endpoint=endpoint,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                latency_ms = int((time.perf_counter() - started_at) * 1000)
                self.state_tracker.record_success(endpoint.id)
                response = self._build_response(
                    request_id,
                    request.model,
                    messages_cache_blob(messages),
                    result.content,
                    result.finish_reason,
                    result,
                )
                cost = self._calculate_cost(
                    endpoint.input_cost_per_1k,
                    endpoint.output_cost_per_1k,
                    result.prompt_tokens,
                    result.completion_tokens,
                )
                request_log = self._persist_log(
                    db,
                    RequestLog(
                        request_id=request_id,
                        endpoint_id=endpoint.id,
                        logical_model=request.model,
                        provider=endpoint.provider_type,
                        actual_model=result.actual_model,
                        prompt_tokens=result.prompt_tokens,
                        completion_tokens=result.completion_tokens,
                        total_tokens=result.total_tokens,
                        cost_usd=cost,
                        latency_ms=latency_ms,
                        cache_hit=False,
                        route_reason=route_reason,
                        status="success",
                        error_code=None,
                        prompt_id=prompt_id,
                        fallback_count=index,
                        timestamp=datetime.now(timezone.utc),
                    ),
                )
                if cache_enabled:
                    self.cache.set(
                        cache_key,
                        {
                            "response": response.model_dump(),
                            "endpoint_id": endpoint.id,
                            "provider": endpoint.provider_type,
                            "route_reason": route_reason,
                        },
                    )
                headers = {
                    "X-Request-ID": request_id,
                    "X-AetherGate-Cache": "miss",
                    "X-AetherGate-Endpoint": str(endpoint.id),
                    "X-AetherGate-Provider": endpoint.provider_type,
                    "X-AetherGate-Fallbacks": str(index),
                    "X-AetherGate-Route-Reason": route_reason,
                }
                return GatewayResult(
                    response=response,
                    headers=headers,
                    request_log_id=request_log.id,
                )
            except ProviderCallError as exc:
                self.state_tracker.record_failure(endpoint.id)
                errors.append(f"{endpoint.name}:{exc.code}")

        error_code = errors[-1].split(":", 1)[-1] if errors else "provider_unavailable"
        request_log = self._persist_log(
            db,
            RequestLog(
                request_id=request_id,
                endpoint_id=candidates[-1].id if candidates else None,
                logical_model=request.model,
                provider=candidates[-1].provider_type if candidates else None,
                actual_model=candidates[-1].model_name if candidates else None,
                prompt_tokens=0,
                completion_tokens=0,
                total_tokens=0,
                cost_usd=0.0,
                latency_ms=0,
                cache_hit=False,
                route_reason=route_reason,
                status="error",
                error_code=error_code,
                prompt_id=prompt_id,
                fallback_count=max(len(candidates) - 1, 0),
                timestamp=datetime.now(timezone.utc),
            ),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "All candidate endpoints failed.", "errors": errors},
            headers={
                "X-Request-ID": request_id,
                "X-AetherGate-Endpoint": str(request_log.endpoint_id or ""),
                "X-AetherGate-Provider": str(request_log.provider or ""),
                "X-AetherGate-Fallbacks": str(request_log.fallback_count),
                "X-AetherGate-Route-Reason": request_log.route_reason or "",
            },
        )

    def list_models(self, db: Session) -> list[str]:
        models = self.endpoint_repository.list_enabled(db)
        return sorted({item.logical_model for item in models})

    def _persist_log(self, db: Session, request_log: RequestLog) -> RequestLog:
        return self.request_log_repository.save(db, request_log)

    def _build_cache_key(
        self,
        messages,
        request: ChatCompletionRequest,
        strategy: str,
        temperature: float,
        prompt_id: str | None,
    ) -> str:
        payload = {
            "messages": messages_cache_blob(messages),
            "model": request.model,
            "strategy": strategy,
            "prompt_id": prompt_id,
            "temperature": temperature,
            "max_tokens": request.max_tokens,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()

    def _build_response(
        self,
        request_id: str,
        logical_model: str,
        prompt_blob: str,
        content: str,
        finish_reason: str,
        result,
    ) -> ChatCompletionResponse:
        prompt_tokens = result.prompt_tokens or approximate_tokens(prompt_blob)
        completion_tokens = result.completion_tokens or approximate_tokens(content)
        total_tokens = result.total_tokens or prompt_tokens + completion_tokens
        return ChatCompletionResponse(
            id=f"chatcmpl-{request_id}",
            created=int(datetime.now(timezone.utc).timestamp()),
            model=logical_model,
            choices=[
                ChatChoice(
                    index=0,
                    message=ChatChoiceMessage(content=content),
                    finish_reason=finish_reason,
                )
            ],
            usage=UsageInfo(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            ),
        )

    def _calculate_cost(
        self,
        input_cost_per_1k: float | None,
        output_cost_per_1k: float | None,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        input_cost = input_cost_per_1k or 0.0
        output_cost = output_cost_per_1k or 0.0
        return round(
            (prompt_tokens / 1000 * input_cost)
            + (completion_tokens / 1000 * output_cost),
            6,
        )


gateway_service = GatewayService()
