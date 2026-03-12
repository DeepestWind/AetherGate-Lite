from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.chat_session import ChatConversation, ChatMessageRecord
from app.repositories.chat_sessions import ChatConversationRepository
from app.repositories.request_logs import RequestLogRepository
from app.schemas.chat import ChatCompletionRequest, ChatMessage
from app.schemas.chat_sessions import ChatConversationConfig
from app.services.gateway import gateway_service


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _next_conversation_id() -> str:
    return f"conv_{uuid4().hex}"


def _next_message_id() -> str:
    return f"msg_{uuid4().hex}"


def _build_title(content: str) -> str:
    normalized = " ".join(content.strip().split())
    if not normalized:
        return "新对话"
    if len(normalized) <= 24:
        return normalized
    return f"{normalized[:24]}…"


def _message_preview(content: str) -> str:
    normalized = " ".join(content.strip().split())
    if len(normalized) <= 120:
        return normalized
    return f"{normalized[:120]}…"


def _stringify_error(detail: object) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        message = detail.get("message")
        if isinstance(message, str) and message.strip():
            return message
    return json.dumps(detail, ensure_ascii=False) if detail is not None else "未知错误"


def _normalize_config(config: ChatConversationConfig) -> dict[str, object]:
    return {
        "model": config.model.strip(),
        "prompt_id": config.prompt_id.strip(),
        "strategy": config.strategy,
        "temperature": config.temperature,
        "variables": {str(key): str(value) for key, value in config.variables.items()},
    }


class ChatSessionService:
    def __init__(self):
        self.repository = ChatConversationRepository()
        self.request_logs = RequestLogRepository()

    def list_conversations(self, db: Session):
        return self.repository.list(db)

    def create_conversation(self, db: Session, config: ChatConversationConfig) -> ChatConversation:
        conversation = ChatConversation(
            conversation_id=_next_conversation_id(),
            title="新对话",
            title_source="auto",
            draft_config=_normalize_config(config),
            message_count=0,
        )
        return self.repository.save(db, conversation)

    def get_conversation(self, db: Session, conversation_id: str) -> ChatConversation:
        conversation = self.repository.get_by_conversation_id(
            db,
            conversation_id,
            include_messages=True,
        )
        if not conversation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        return conversation

    def update_conversation(self, db: Session, conversation_id: str, config: ChatConversationConfig) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        conversation.draft_config = _normalize_config(config)
        return self.repository.save(db, conversation)

    def delete_conversation(self, db: Session, conversation_id: str) -> None:
        conversation = self.get_conversation(db, conversation_id)
        self.repository.delete(db, conversation)

    def clear_conversation(self, db: Session, conversation_id: str) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        conversation.messages.clear()
        conversation.message_count = 0
        conversation.last_message_preview = None
        conversation.last_message_role = None
        conversation.last_message_at = None
        conversation.updated_at = _now()
        self.repository.save(db, conversation)
        return self.get_conversation(db, conversation_id)

    async def send_message(
        self,
        db: Session,
        conversation_id: str,
        content: str,
        config: ChatConversationConfig,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        normalized_content = content.strip()
        if not normalized_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content is required.")

        draft_config = _normalize_config(config)
        completed_history = [
            ChatMessage(role=message.role, content=message.content_text)
            for message in conversation.messages
            if message.status == "completed" and message.role in {"assistant", "system", "tool", "user"}
        ]

        next_seq = conversation.message_count
        user_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=next_seq + 1,
            role="user",
            content_text=normalized_content,
            status="completed",
        )
        assistant_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=next_seq + 2,
            role="assistant",
            content_text="",
            status="pending",
            strategy=config.strategy,
        )

        sent_at = _now()
        if conversation.message_count == 0 and conversation.title_source == "auto":
            conversation.title = _build_title(normalized_content)
        conversation.draft_config = draft_config
        conversation.messages.extend([user_message, assistant_message])
        conversation.message_count = next_seq + 2
        conversation.last_message_preview = _message_preview(normalized_content)
        conversation.last_message_role = "user"
        conversation.last_message_at = sent_at
        conversation.updated_at = sent_at
        db.add(conversation)
        db.commit()

        gateway_request = ChatCompletionRequest(
            model=config.model.strip(),
            messages=[*completed_history, ChatMessage(role="user", content=normalized_content)],
            temperature=config.temperature,
            prompt_id=config.prompt_id.strip() or None,
            prompt_variables=config.variables,
            strategy=config.strategy,
            stream=False,
        )

        try:
            result = await gateway_service.handle_chat(db, gateway_request)
            assistant_message.content_text = result.response.choices[0].message.content
            assistant_message.status = "completed"
            assistant_message.finish_reason = result.response.choices[0].finish_reason
            assistant_message.request_log_id = result.request_log_id
            assistant_message.error_message = None
            conversation.last_message_preview = _message_preview(assistant_message.content_text)
            conversation.last_message_role = "assistant"
            conversation.last_message_at = _now()
            conversation.updated_at = conversation.last_message_at
            db.add(conversation)
            db.commit()
        except HTTPException as exc:
            request_id = exc.headers.get("X-Request-ID") if exc.headers else None
            request_log = self.request_logs.get_by_request_id(db, request_id) if request_id else None
            error_message = _stringify_error(exc.detail)
            assistant_message.content_text = f"调用失败：{error_message}"
            assistant_message.status = "error"
            assistant_message.finish_reason = "error"
            assistant_message.request_log_id = request_log.id if request_log else None
            assistant_message.error_message = error_message
            conversation.last_message_preview = _message_preview(assistant_message.content_text)
            conversation.last_message_role = "assistant"
            conversation.last_message_at = _now()
            conversation.updated_at = conversation.last_message_at
            db.add(conversation)
            db.commit()

        return self.get_conversation(db, conversation_id)


chat_session_service = ChatSessionService()
