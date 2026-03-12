from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.db.session import get_db
from app.models.chat_session import ChatConversation, ChatMessageRecord
from app.models.request_log import RequestLog
from app.schemas.chat_sessions import (
    ChatCallInfoResponse,
    ChatConversationConfig,
    ChatConversationCreate,
    ChatConversationResponse,
    ChatConversationSummaryResponse,
    ChatConversationUpdate,
    ChatMessageResponse,
    ChatConversationMessageCreate,
)
from app.services.chat_sessions import chat_session_service

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
    dependencies=[Depends(require_bearer_token)],
)


def _to_millis(value):
    if value is None:
        return None
    return int(value.timestamp() * 1000)


def _to_call_info(message: ChatMessageRecord) -> ChatCallInfoResponse | None:
    request_log: RequestLog | None = message.request_log
    if not request_log or not message.strategy:
        return None

    if request_log.status == "error":
        status_value = "error"
    elif request_log.fallback_count > 0:
        status_value = "fallback"
    else:
        status_value = "success"

    return ChatCallInfoResponse(
        request_id=request_log.request_id,
        provider=request_log.provider or "",
        model=request_log.actual_model or request_log.logical_model,
        route_reason=request_log.route_reason or "",
        cache_hit=request_log.cache_hit,
        endpoint_id=str(request_log.endpoint_id or ""),
        fallback_count=request_log.fallback_count,
        latency_ms=request_log.latency_ms,
        prompt_tokens=request_log.prompt_tokens,
        completion_tokens=request_log.completion_tokens,
        total_tokens=request_log.total_tokens,
        cost_usd=request_log.cost_usd,
        strategy=message.strategy,
        status=status_value,
    )


def _to_message_response(message: ChatMessageRecord) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=message.message_id,
        role=message.role,
        content=message.content_text,
        status=message.status,
        timestamp=_to_millis(message.created_at),
        call_info=_to_call_info(message),
        error_message=message.error_message,
    )


def _to_summary_response(conversation: ChatConversation) -> ChatConversationSummaryResponse:
    return ChatConversationSummaryResponse(
        id=conversation.conversation_id,
        title=conversation.title,
        draft_config=ChatConversationConfig.model_validate(conversation.draft_config or {}),
        last_message_at=_to_millis(conversation.last_message_at),
        last_message_preview=conversation.last_message_preview,
        last_message_role=conversation.last_message_role,
        message_count=conversation.message_count,
        created_at=_to_millis(conversation.created_at),
        updated_at=_to_millis(conversation.updated_at),
    )


def _to_conversation_response(conversation: ChatConversation) -> ChatConversationResponse:
    summary = _to_summary_response(conversation)
    return ChatConversationResponse(
        **summary.model_dump(),
        messages=[_to_message_response(message) for message in conversation.messages],
    )


@router.get("/conversations", response_model=list[ChatConversationSummaryResponse])
def list_conversations(db: Session = Depends(get_db)):
    return [_to_summary_response(conversation) for conversation in chat_session_service.list_conversations(db)]


@router.post(
    "/conversations",
    response_model=ChatConversationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(payload: ChatConversationCreate, db: Session = Depends(get_db)):
    conversation = chat_session_service.create_conversation(db, payload.draft_config)
    return _to_conversation_response(chat_session_service.get_conversation(db, conversation.conversation_id))


@router.get("/conversations/{conversation_id}", response_model=ChatConversationResponse)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    return _to_conversation_response(chat_session_service.get_conversation(db, conversation_id))


@router.put("/conversations/{conversation_id}/config", response_model=ChatConversationSummaryResponse)
def update_conversation(
    conversation_id: str,
    payload: ChatConversationUpdate,
    db: Session = Depends(get_db),
):
    return _to_summary_response(
        chat_session_service.update_conversation(db, conversation_id, payload.draft_config),
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    chat_session_service.delete_conversation(db, conversation_id)


@router.delete("/conversations/{conversation_id}/messages", response_model=ChatConversationResponse)
def clear_conversation(conversation_id: str, db: Session = Depends(get_db)):
    return _to_conversation_response(chat_session_service.clear_conversation(db, conversation_id))


@router.post("/conversations/{conversation_id}/messages", response_model=ChatConversationResponse)
async def send_message(
    conversation_id: str,
    payload: ChatConversationMessageCreate,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        await chat_session_service.send_message(
            db,
            conversation_id,
            payload.content,
            payload.draft_config,
        ),
    )
