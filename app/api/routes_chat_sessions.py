from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.db.session import get_db
from app.models.chat_session import ChatBranch, ChatConversation, ChatMessageRecord
from app.models.request_log import RequestLog
from app.schemas.chat_sessions import (
    ChatBranchResponse,
    ChatCallInfoResponse,
    ChatConversationBranchCreate,
    ChatConversationConfig,
    ChatConversationCreate,
    ChatConversationMessageCommitCreate,
    ChatConversationMessageCreate,
    ChatConversationMessagePinUpdate,
    ChatConversationMessageRegenerateCreate,
    ChatConversationResponse,
    ChatConversationRename,
    ChatConversationSummaryResponse,
    ChatConversationUpdate,
    ChatMessageResponse,
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
        parent_id=message.parent_message_id,
        modified_from=message.modified_from_message_id,
        pinned=message.pinned,
        archived=message.archived,
        stale=message.stale,
        call_info=_to_call_info(message),
        error_message=message.error_message,
    )


def _to_branch_response(branch: ChatBranch) -> ChatBranchResponse:
    return ChatBranchResponse(
        id=branch.branch_id,
        name=branch.name,
        head_message_id=branch.head_message_id,
        base_message_id=branch.base_message_id,
    )


def _to_summary_response(conversation: ChatConversation) -> ChatConversationSummaryResponse:
    return ChatConversationSummaryResponse(
        id=conversation.conversation_id,
        title=conversation.title,
        draft_config=ChatConversationConfig.model_validate(conversation.draft_config or {}),
        last_message_at=_to_millis(conversation.last_message_at),
        last_message_preview=conversation.last_message_preview,
        last_message_role=conversation.last_message_role,
        active_branch_id=conversation.active_branch_id,
        message_count=conversation.message_count,
        created_at=_to_millis(conversation.created_at),
        updated_at=_to_millis(conversation.updated_at),
    )


def _to_conversation_response(conversation: ChatConversation) -> ChatConversationResponse:
    summary = _to_summary_response(conversation)
    visible_messages = chat_session_service.flatten_messages(conversation)
    node_store = {
        message.message_id: _to_message_response(message)
        for message in conversation.messages
    }
    return ChatConversationResponse(
        **summary.model_dump(),
        branches=[_to_branch_response(branch) for branch in conversation.branches],
        messages=[_to_message_response(message) for message in visible_messages],
        message_nodes=node_store,
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


@router.patch("/conversations/{conversation_id}", response_model=ChatConversationSummaryResponse)
def rename_conversation(
    conversation_id: str,
    payload: ChatConversationRename,
    db: Session = Depends(get_db),
):
    return _to_summary_response(
        chat_session_service.rename_conversation(db, conversation_id, payload.title),
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


@router.post("/conversations/{conversation_id}/messages/commit", response_model=ChatConversationResponse)
async def commit_message_edits_and_send_message(
    conversation_id: str,
    payload: ChatConversationMessageCommitCreate,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        await chat_session_service.send_message(
            db,
            conversation_id,
            payload.content,
            payload.draft_config,
            modified_nodes=payload.modified_nodes,
        ),
    )


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/regenerate",
    response_model=ChatConversationResponse,
)
async def regenerate_message(
    conversation_id: str,
    message_id: str,
    payload: ChatConversationMessageRegenerateCreate,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        await chat_session_service.regenerate_message(
            db,
            conversation_id,
            message_id,
            payload.draft_config,
            modified_nodes=payload.modified_nodes,
        ),
    )


@router.post(
    "/conversations/{conversation_id}/messages/{message_id}/select",
    response_model=ChatConversationResponse,
)
def select_message_variant(
    conversation_id: str,
    message_id: str,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        chat_session_service.select_message_variant(db, conversation_id, message_id),
    )


@router.patch(
    "/conversations/{conversation_id}/messages/{message_id}/pin",
    response_model=ChatConversationResponse,
)
def update_message_pin(
    conversation_id: str,
    message_id: str,
    payload: ChatConversationMessagePinUpdate,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        chat_session_service.set_message_pin(
            db,
            conversation_id,
            message_id,
            payload.pinned,
        ),
    )


@router.post("/conversations/{conversation_id}/branches", response_model=ChatConversationResponse)
def create_branch(
    conversation_id: str,
    payload: ChatConversationBranchCreate,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        chat_session_service.create_branch(
            db,
            conversation_id,
            payload.base_message_id,
            name=payload.name,
        ),
    )


@router.post(
    "/conversations/{conversation_id}/branches/{branch_id}/activate",
    response_model=ChatConversationResponse,
)
def activate_branch(
    conversation_id: str,
    branch_id: str,
    db: Session = Depends(get_db),
):
    return _to_conversation_response(
        chat_session_service.activate_branch(db, conversation_id, branch_id),
    )
