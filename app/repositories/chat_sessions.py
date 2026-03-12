from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.chat_session import ChatConversation, ChatMessageRecord


class ChatConversationRepository:
    def list(self, db: Session) -> Sequence[ChatConversation]:
        stmt = select(ChatConversation).order_by(ChatConversation.updated_at.desc(), ChatConversation.id.desc())
        return db.scalars(stmt).all()

    def get_by_conversation_id(
        self,
        db: Session,
        conversation_id: str,
        *,
        include_messages: bool = False,
    ) -> ChatConversation | None:
        stmt = select(ChatConversation).where(ChatConversation.conversation_id == conversation_id)
        if include_messages:
            stmt = stmt.options(
                selectinload(ChatConversation.messages).joinedload(ChatMessageRecord.request_log),
            )
        return db.scalar(stmt)

    def save(self, db: Session, conversation: ChatConversation) -> ChatConversation:
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        return conversation

    def delete(self, db: Session, conversation: ChatConversation) -> None:
        db.delete(conversation)
        db.commit()
