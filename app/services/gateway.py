from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.endpoint import ModelEndpoint
from app.models.request_log import RequestLog
from app.providers.base import ProviderCallError, ProviderStreamEvent
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


@dataclass(slots=True)
class GatewayStreamCallInfo:
    request_id: str
    provider: str
    model: str
    route_reason: str
    cache_hit: bool
    endpoint_id: str
    fallback_count: int
    strategy: str
    latency_ms: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    status: str = "success"


@dataclass(slots=True)
class GatewayStreamResult:
    kind: str
    call_info: GatewayStreamCallInfo
    delta: str = ""
    content: str = ""
    finish_reason: str | None = None
    error_message: str | None = None
    request_log_id: int | None = None


@dataclass(slots=True)
class GatewayStreamSession:
    request_id: str
    logical_model: str
    prompt_id: str | None
    prompt_blob: str
    route_reason: str
    strategy: str
    endpoint: ModelEndpoint
    fallback_count: int
    started_at: float
    headers: dict[str, str]
    call_info: GatewayStreamCallInfo
    iterator: AsyncIterator[ProviderStreamEvent]
    first_event: ProviderStreamEvent | None
    cancel_event: asyncio.Event | None = None


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
                detail="Use streaming route handling when stream=true.",
            )

        request_id, strategy, temperature, max_tokens, messages, prompt_id = self._prepare_request(
            db,
            request,
        )
        prompt_blob = messages_cache_blob(messages)
        cache_key = self._build_cache_key(messages, request, strategy, temperature, prompt_id)
        cache_enabled = (
            not request.disable_cache
            and temperature <= self.settings.cache_temperature_threshold
        )
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
                return GatewayResult(
                    response=response,
                    headers=self._build_headers(
                        request_id=request_id,
                        endpoint_id=str(cached.get("endpoint_id") or ""),
                        provider=str(cached.get("provider") or ""),
                        fallback_count=0,
                        route_reason=cached.get("route_reason", "cache"),
                        cache_state="hit",
                    ),
                    request_log_id=request_log.id if request_log else None,
                )

        candidates, route_reason = self._choose_candidates(
            db,
            request,
            request_id,
            strategy,
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
                    prompt_blob,
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
                return GatewayResult(
                    response=response,
                    headers=self._build_headers(
                        request_id=request_id,
                        endpoint_id=str(endpoint.id),
                        provider=endpoint.provider_type,
                        fallback_count=index,
                        route_reason=route_reason,
                        cache_state="miss",
                    ),
                    request_log_id=request_log.id,
                )
            except ProviderCallError as exc:
                self.state_tracker.record_failure(endpoint.id)
                errors.append(f"{endpoint.name}:{exc.code}")

        request_log = self._persist_terminal_error(
            db,
            request_id=request_id,
            logical_model=request.model,
            prompt_id=prompt_id,
            route_reason=route_reason,
            fallback_count=max(len(candidates) - 1, 0),
            errors=errors,
            endpoint=candidates[-1] if candidates else None,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "All candidate endpoints failed.", "errors": errors},
            headers=self._build_headers(
                request_id=request_id,
                endpoint_id=str(request_log.endpoint_id or ""),
                provider=str(request_log.provider or ""),
                fallback_count=request_log.fallback_count,
                route_reason=request_log.route_reason or "",
                cache_state="miss",
            ),
        )

    async def begin_chat_stream(
        self,
        db: Session,
        request: ChatCompletionRequest,
        *,
        cancel_event: asyncio.Event | None = None,
    ) -> GatewayStreamSession:
        request_id, strategy, temperature, max_tokens, messages, prompt_id = self._prepare_request(
            db,
            request,
        )
        prompt_blob = messages_cache_blob(messages)
        candidates, route_reason = self._choose_candidates(
            db,
            request,
            request_id,
            strategy,
        )
        errors: list[str] = []
        for index, endpoint in enumerate(candidates):
            provider = self.providers.get(endpoint.provider_type)
            started_at = time.perf_counter()
            iterator = provider.stream_chat_completions(
                endpoint=endpoint,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                cancel_event=cancel_event,
            )
            try:
                first_event = await self._next_stream_event(iterator)
            except ProviderCallError as exc:
                self.state_tracker.record_failure(endpoint.id)
                errors.append(f"{endpoint.name}:{exc.code}")
                continue

            self.state_tracker.record_success(endpoint.id)
            actual_model = first_event.actual_model if first_event else endpoint.model_name
            call_info = GatewayStreamCallInfo(
                request_id=request_id,
                provider=endpoint.provider_type,
                model=actual_model,
                route_reason=route_reason,
                cache_hit=False,
                endpoint_id=str(endpoint.id),
                fallback_count=index,
                strategy=strategy,
            )
            return GatewayStreamSession(
                request_id=request_id,
                logical_model=request.model,
                prompt_id=prompt_id,
                prompt_blob=prompt_blob,
                route_reason=route_reason,
                strategy=strategy,
                endpoint=endpoint,
                fallback_count=index,
                started_at=started_at,
                headers=self._build_headers(
                    request_id=request_id,
                    endpoint_id=str(endpoint.id),
                    provider=endpoint.provider_type,
                    fallback_count=index,
                    route_reason=route_reason,
                    cache_state="miss",
                ),
                call_info=call_info,
                iterator=iterator,
                first_event=first_event,
                cancel_event=cancel_event,
            )

        request_log = self._persist_terminal_error(
            db,
            request_id=request_id,
            logical_model=request.model,
            prompt_id=prompt_id,
            route_reason=route_reason,
            fallback_count=max(len(candidates) - 1, 0),
            errors=errors,
            endpoint=candidates[-1] if candidates else None,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "All candidate endpoints failed.", "errors": errors},
            headers=self._build_headers(
                request_id=request_id,
                endpoint_id=str(request_log.endpoint_id or ""),
                provider=str(request_log.provider or ""),
                fallback_count=request_log.fallback_count,
                route_reason=request_log.route_reason or "",
                cache_state="miss",
            ),
        )

    async def iterate_chat_stream(
        self,
        db: Session,
        session: GatewayStreamSession,
    ) -> AsyncIterator[GatewayStreamResult]:
        content_parts: list[str] = []
        prompt_tokens: int | None = None
        completion_tokens: int | None = None
        total_tokens: int | None = None
        finish_reason = "stop"
        actual_model = session.call_info.model
        try:
            async for event in self._iterate_provider_events(session.first_event, session.iterator):
                if event.delta:
                    content_parts.append(event.delta)
                    yield GatewayStreamResult(
                        kind="delta",
                        call_info=session.call_info,
                        delta=event.delta,
                        content="".join(content_parts),
                    )
                if event.finish_reason:
                    finish_reason = event.finish_reason
                if event.prompt_tokens is not None:
                    prompt_tokens = event.prompt_tokens
                if event.completion_tokens is not None:
                    completion_tokens = event.completion_tokens
                if event.total_tokens is not None:
                    total_tokens = event.total_tokens
                if event.actual_model:
                    actual_model = event.actual_model

            cancelled = bool(session.cancel_event and session.cancel_event.is_set())
            content = "".join(content_parts)
            latency_ms = int((time.perf_counter() - session.started_at) * 1000)
            prompt_tokens = prompt_tokens or approximate_tokens(session.prompt_blob)
            completion_tokens = completion_tokens or approximate_tokens(content)
            total_tokens = total_tokens or prompt_tokens + completion_tokens
            cost = self._calculate_cost(
                session.endpoint.input_cost_per_1k,
                session.endpoint.output_cost_per_1k,
                prompt_tokens,
                completion_tokens,
            )
            request_log = self._persist_log(
                db,
                RequestLog(
                    request_id=session.request_id,
                    endpoint_id=session.endpoint.id,
                    logical_model=session.logical_model,
                    provider=session.endpoint.provider_type,
                    actual_model=actual_model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    cost_usd=cost,
                    latency_ms=latency_ms,
                    cache_hit=False,
                    route_reason=session.route_reason,
                    status="cancelled" if cancelled else "success",
                    error_code=None,
                    prompt_id=session.prompt_id,
                    fallback_count=session.fallback_count,
                    timestamp=datetime.now(timezone.utc),
                ),
            )
            call_info = replace(
                session.call_info,
                model=actual_model,
                latency_ms=latency_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost,
                status="cancelled" if cancelled else ("fallback" if session.fallback_count > 0 else "success"),
            )
            yield GatewayStreamResult(
                kind="cancelled" if cancelled else "completed",
                call_info=call_info,
                content=content,
                finish_reason="cancelled" if cancelled else finish_reason,
                request_log_id=request_log.id,
            )
        except ProviderCallError as exc:
            self.state_tracker.record_failure(session.endpoint.id)
            content = "".join(content_parts)
            latency_ms = int((time.perf_counter() - session.started_at) * 1000)
            prompt_tokens = prompt_tokens or approximate_tokens(session.prompt_blob)
            completion_tokens = completion_tokens or approximate_tokens(content)
            total_tokens = total_tokens or prompt_tokens + completion_tokens
            request_log = self._persist_log(
                db,
                RequestLog(
                    request_id=session.request_id,
                    endpoint_id=session.endpoint.id,
                    logical_model=session.logical_model,
                    provider=session.endpoint.provider_type,
                    actual_model=actual_model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    cost_usd=0.0,
                    latency_ms=latency_ms,
                    cache_hit=False,
                    route_reason=session.route_reason,
                    status="error",
                    error_code=exc.code,
                    prompt_id=session.prompt_id,
                    fallback_count=session.fallback_count,
                    timestamp=datetime.now(timezone.utc),
                ),
            )
            yield GatewayStreamResult(
                kind="error",
                call_info=replace(
                    session.call_info,
                    model=actual_model,
                    latency_ms=latency_ms,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    status="error",
                ),
                content=content,
                finish_reason="error",
                error_message=exc.message,
                request_log_id=request_log.id,
            )

    def list_models(self, db: Session) -> list[str]:
        models = self.endpoint_repository.list_enabled(db)
        return sorted({item.logical_model for item in models})

    def _prepare_request(
        self,
        db: Session,
        request: ChatCompletionRequest,
    ) -> tuple[str, str, float, int, list, str | None]:
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
        return request_id, strategy, temperature, max_tokens, messages, prompt_id

    def _choose_candidates(
        self,
        db: Session,
        request: ChatCompletionRequest,
        request_id: str,
        strategy: str,
    ) -> tuple[list[ModelEndpoint], str]:
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
        return candidates, route_reason

    async def _next_stream_event(
        self,
        iterator: AsyncIterator[ProviderStreamEvent],
    ) -> ProviderStreamEvent | None:
        try:
            return await anext(iterator)
        except StopAsyncIteration:
            return None

    async def _iterate_provider_events(
        self,
        first_event: ProviderStreamEvent | None,
        iterator: AsyncIterator[ProviderStreamEvent],
    ) -> AsyncIterator[ProviderStreamEvent]:
        if first_event is not None:
            yield first_event
        async for event in iterator:
            yield event

    def _persist_log(self, db: Session, request_log: RequestLog) -> RequestLog:
        return self.request_log_repository.save(db, request_log)

    def _persist_terminal_error(
        self,
        db: Session,
        *,
        request_id: str,
        logical_model: str,
        prompt_id: str | None,
        route_reason: str,
        fallback_count: int,
        errors: list[str],
        endpoint: ModelEndpoint | None,
    ) -> RequestLog:
        error_code = errors[-1].split(":", 1)[-1] if errors else "provider_unavailable"
        return self._persist_log(
            db,
            RequestLog(
                request_id=request_id,
                endpoint_id=endpoint.id if endpoint else None,
                logical_model=logical_model,
                provider=endpoint.provider_type if endpoint else None,
                actual_model=endpoint.model_name if endpoint else None,
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
                fallback_count=fallback_count,
                timestamp=datetime.now(timezone.utc),
            ),
        )

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

    def _build_headers(
        self,
        *,
        request_id: str,
        endpoint_id: str,
        provider: str,
        fallback_count: int,
        route_reason: str,
        cache_state: str,
    ) -> dict[str, str]:
        return {
            "X-Request-ID": request_id,
            "X-Branchat-Cache": cache_state,
            "X-Branchat-Endpoint": endpoint_id,
            "X-Branchat-Provider": provider,
            "X-Branchat-Fallbacks": str(fallback_count),
            "X-Branchat-Route-Reason": route_reason,
        }

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
