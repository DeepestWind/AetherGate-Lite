from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


class ChatConversation(TimestampMixin, Base):
    __tablename__ = "chat_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), default="新对话")
    title_source: Mapped[str] = mapped_column(String(20), default="auto")
    draft_config: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    last_message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_message_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    messages: Mapped[list["ChatMessageRecord"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessageRecord.seq",
    )


class ChatMessageRecord(TimestampMixin, Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    conversation_db_id: Mapped[int] = mapped_column(
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        index=True,
    )
    seq: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(16), index=True)
    content_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="completed", index=True)
    strategy: Mapped[str | None] = mapped_column(String(50), nullable=True)
    request_log_id: Mapped[int | None] = mapped_column(
        ForeignKey("request_logs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    finish_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)

    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")
    request_log = relationship("RequestLog")
