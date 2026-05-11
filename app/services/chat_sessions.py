from __future__ import annotations

import asyncio
import json
import math
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.chat_session import ChatBranch, ChatConversation, ChatMessageRecord
from app.repositories.chat_sessions import ChatConversationRepository
from app.repositories.request_logs import RequestLogRepository
from app.schemas.chat import ChatCompletionRequest, ChatMessage
from app.schemas.chat_sessions import (
    ChatConversationConfig,
    ChatConversationMessageNodeEdit,
    VisibleMessageResponse,
)
from app.services.gateway import gateway_service
from app.services.prompt_utils import approximate_tokens


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _next_conversation_id() -> str:
    return f"conv_{uuid4().hex}"


def _next_message_id() -> str:
    return f"msg_{uuid4().hex}"


def _next_branch_id() -> str:
    return f"branch_{uuid4().hex}"


def _to_millis(value: datetime | None) -> int | None:
    if value is None:
        return None
    return int(value.timestamp() * 1000)


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


def _message_version(message: ChatMessageRecord) -> int:
    return int(message.version or 0)


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


@dataclass(frozen=True, slots=True)
class ContextCompressionProfile:
    window_tokens: int
    trigger_ratio: float
    compression_ratio: float


@dataclass(frozen=True, slots=True)
class BranchingEdit:
    content: str
    source_message: ChatMessageRecord


@dataclass(frozen=True, slots=True)
class ChatSessionStreamMeta:
    request_id: str
    provider: str
    model: str
    route_reason: str
    cache_hit: bool
    endpoint_id: str
    fallback_count: int
    strategy: str


@dataclass(frozen=True, slots=True)
class ChatSessionStreamEvent:
    kind: str
    assistant_message_id: str | None = None
    user_message_id: str | None = None
    branch_id: str | None = None
    delta: str | None = None
    content: str | None = None
    meta: ChatSessionStreamMeta | None = None
    conversation: ChatConversation | None = None
    error_message: str | None = None


SMALL_CONTEXT_PROFILE = ContextCompressionProfile(
    window_tokens=128_000,
    trigger_ratio=0.60,
    compression_ratio=0.50,
)
MEDIUM_CONTEXT_PROFILE = ContextCompressionProfile(
    window_tokens=256_000,
    trigger_ratio=0.70,
    compression_ratio=0.40,
)
LARGE_CONTEXT_PROFILE = ContextCompressionProfile(
    window_tokens=1_000_000,
    trigger_ratio=0.80,
    compression_ratio=0.30,
)

KNOWN_MODEL_WINDOWS: dict[str, int] = {
    "gpt-4.1": 1_000_000,
    "gpt-4.1-mini": 1_000_000,
    "gpt-4.1-nano": 1_000_000,
    "gpt-4o": 128_000,
    "gpt-4o-mini": 128_000,
    "gpt-5": 400_000,
    "gpt-5-mini": 400_000,
    "gpt-5-nano": 400_000,
}


class ChatSessionService:
    def __init__(self):
        self.repository = ChatConversationRepository()
        self.request_logs = RequestLogRepository()
        self._active_generations: dict[str, asyncio.Event] = {}

    def list_conversations(self, db: Session):
        return self.repository.list(db)

    def create_conversation(self, db: Session, config: ChatConversationConfig) -> ChatConversation:
        main_branch = ChatBranch(
            branch_id=_next_branch_id(),
            name="main",
            head_message_id=None,
            base_message_id=None,
        )
        conversation = ChatConversation(
            conversation_id=_next_conversation_id(),
            title="新对话",
            title_source="auto",
            draft_config=_normalize_config(config),
            message_count=0,
            active_branch_id=main_branch.branch_id,
            branches=[main_branch],
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
        if self._ensure_graph_state(conversation):
            conversation = self.repository.save(db, conversation)
            refreshed = self.repository.get_by_conversation_id(
                db,
                conversation_id,
                include_messages=True,
            )
            if refreshed:
                return refreshed
        return conversation

    def update_conversation(self, db: Session, conversation_id: str, config: ChatConversationConfig) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        conversation.draft_config = _normalize_config(config)
        return self.repository.save(db, conversation)

    def rename_conversation(self, db: Session, conversation_id: str, title: str) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        normalized_title = " ".join(title.strip().split())
        if not normalized_title:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Title is required.")

        conversation.title = normalized_title
        conversation.title_source = "manual"
        return self.repository.save(db, conversation)

    def delete_conversation(self, db: Session, conversation_id: str) -> None:
        conversation = self.get_conversation(db, conversation_id)
        self.repository.delete(db, conversation)

    def clear_conversation(self, db: Session, conversation_id: str) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        conversation.messages.clear()
        for branch in conversation.branches:
            branch.head_message_id = None
            branch.base_message_id = None
            branch.compressed_path_json = None
            branch.compressed_at_head_message_id = None
            branch.compressed_source_versions_json = None
        conversation.message_count = 0
        conversation.last_message_preview = None
        conversation.last_message_role = None
        conversation.last_message_at = None
        conversation.updated_at = _now()
        self.repository.save(db, conversation)
        return self.get_conversation(db, conversation_id)

    def build_message_store(self, conversation: ChatConversation) -> dict[str, ChatMessageRecord]:
        return {
            message.message_id: message
            for message in conversation.messages
            if message.message_id
        }

    def get_active_branch(self, conversation: ChatConversation) -> ChatBranch | None:
        if not conversation.branches:
            return None

        if conversation.active_branch_id:
            for branch in conversation.branches:
                if branch.branch_id == conversation.active_branch_id:
                    return branch

        for branch in conversation.branches:
            if branch.name == "main":
                return branch

        return conversation.branches[0]

    def flatten_messages(
        self,
        conversation: ChatConversation,
        *,
        branch_id: str | None = None,
        include_archived: bool = False,
    ) -> list[ChatMessageRecord]:
        branch = self._select_branch(conversation, branch_id)
        if not branch or not branch.head_message_id:
            return []

        return self.flatten_from_message_id(
            conversation,
            branch.head_message_id,
            include_archived=include_archived,
        )

    def flatten_from_message_id(
        self,
        conversation: ChatConversation,
        message_id: str | None,
        *,
        include_archived: bool = False,
    ) -> list[ChatMessageRecord]:
        if not message_id:
            return []

        node_store = self.build_message_store(conversation)
        current_id = message_id
        path: list[ChatMessageRecord] = []
        visited: set[str] = set()

        while current_id:
            if current_id in visited:
                break

            node = node_store.get(current_id)
            if node is None:
                break

            if include_archived or not node.archived:
                path.append(node)

            visited.add(current_id)
            current_id = node.parent_message_id

        path.reverse()
        return path

    def build_completed_history(
        self,
        conversation: ChatConversation,
        *,
        branch_id: str | None = None,
        message_id: str | None = None,
    ) -> list[ChatMessage]:
        if message_id is not None:
            return self._walk_to_context_messages(conversation, message_id)

        branch = self._select_branch(conversation, branch_id)
        if not branch or not branch.head_message_id:
            return []
        return self._walk_to_context_messages(conversation, branch.head_message_id)

    def set_message_pin(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
        pinned: bool,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        node_store = self.build_message_store(conversation)
        message = node_store.get(message_id)
        if message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {message_id}",
            )
        if message.role == "summary" and not pinned:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Summary messages stay pinned.",
            )

        if message.pinned != pinned:
            message.pinned = pinned
            message.version = _message_version(message) + 1
        conversation.updated_at = _now()
        return self.repository.save(db, conversation)

    async def edit_message_in_new_branch(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
        content: str,
        config: ChatConversationConfig,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        normalized_content = content.strip()
        if not normalized_content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Message content is required.",
            )

        node_store = self.build_message_store(conversation)
        source_message = node_store.get(message_id)
        if source_message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {message_id}",
            )
        if source_message.role not in {"assistant", "user"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only user and assistant messages can be edited into a branch.",
            )
        if normalized_content == source_message.content_text:
            return conversation
        if not self._message_has_visible_children(conversation, source_message.message_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only non-leaf messages can be edited into a new branch.",
            )

        await self._branch_from_non_leaf_edit(
            db,
            conversation,
            source_message,
            normalized_content,
            config,
            auto_generate_user_reply=source_message.role == "user",
        )
        if source_message.role != "user":
            db.add(conversation)
            db.commit()
        return self.get_conversation(db, conversation_id)

    def create_branch(
        self,
        db: Session,
        conversation_id: str,
        base_message_id: str,
        *,
        name: str | None = None,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        node_store = self.build_message_store(conversation)
        base_message = node_store.get(base_message_id)
        if base_message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {base_message_id}",
            )

        branch_name = self._resolve_branch_name(conversation, name)
        branch = ChatBranch(
            branch_id=_next_branch_id(),
            name=branch_name,
            head_message_id=base_message.message_id,
            base_message_id=base_message.message_id,
        )
        conversation.branches.append(branch)
        conversation.active_branch_id = branch.branch_id
        self._sync_active_branch_summary(conversation, branch)
        return self.repository.save(db, conversation)

    def activate_branch(
        self,
        db: Session,
        conversation_id: str,
        branch_id: str,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        branch = self._select_branch(conversation, branch_id)
        if branch is None or branch.branch_id != branch_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Branch not found: {branch_id}",
            )

        conversation.active_branch_id = branch.branch_id
        self._sync_active_branch_summary(conversation, branch)
        return self.repository.save(db, conversation)

    def stop_generation(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
    ) -> None:
        conversation = self.get_conversation(db, conversation_id)
        node_store = self.build_message_store(conversation)
        message = node_store.get(message_id)
        if message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {message_id}",
            )
        cancel_event = self._active_generations.get(message_id)
        if cancel_event is not None:
            cancel_event.set()

    async def stream_send_message(
        self,
        db: Session,
        conversation_id: str,
        content: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> AsyncIterator[ChatSessionStreamEvent]:
        (
            conversation,
            branch,
            user_message,
            assistant_message,
            completed_history,
            _,
        ) = await self._prepare_send_generation(
            db,
            conversation_id,
            content,
            config,
            modified_nodes=modified_nodes,
        )
        async for event in self._stream_assistant_generation(
            db,
            conversation,
            branch,
            assistant_message,
            config,
            completed_history,
            user_message_id=user_message.message_id,
        ):
            yield event

    async def stream_edit_message_in_new_branch(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
        content: str,
        config: ChatConversationConfig,
    ) -> AsyncIterator[ChatSessionStreamEvent]:
        conversation = self.get_conversation(db, conversation_id)
        normalized_content = content.strip()
        if not normalized_content:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Message content is required.",
            )

        node_store = self.build_message_store(conversation)
        source_message = node_store.get(message_id)
        if source_message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {message_id}",
            )
        if source_message.role not in {"assistant", "user"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only user and assistant messages can be edited into a branch.",
            )
        if normalized_content == source_message.content_text:
            yield ChatSessionStreamEvent(
                kind="message.completed",
                conversation=self.get_conversation(db, conversation_id),
            )
            return
        if not self._message_has_visible_children(conversation, source_message.message_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only non-leaf messages can be edited into a new branch.",
            )

        if source_message.role != "user":
            await self._branch_from_non_leaf_edit(
                db,
                conversation,
                source_message,
                normalized_content,
                config,
                auto_generate_user_reply=False,
            )
            db.add(conversation)
            db.commit()
            yield ChatSessionStreamEvent(
                kind="message.completed",
                conversation=self.get_conversation(db, conversation_id),
            )
            return

        edited_message = self._create_edited_message_variant(conversation, source_message, normalized_content)
        branch = ChatBranch(
            branch_id=_next_branch_id(),
            name=self._resolve_branch_name(conversation, None),
            head_message_id=None,
            base_message_id=self._build_branch_base_message_id(conversation, edited_message.message_id),
        )
        assistant_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=conversation.message_count + 1,
            role="assistant",
            content_text="",
            parent_message_id=edited_message.message_id,
            status="pending",
            strategy=config.strategy,
        )
        branch.head_message_id = assistant_message.message_id
        conversation.branches.append(branch)
        conversation.messages.append(assistant_message)
        conversation.message_count += 1
        conversation.active_branch_id = branch.branch_id
        conversation.draft_config = _normalize_config(config)
        branched_at = _now()
        conversation.last_message_preview = _message_preview(edited_message.content_text)
        conversation.last_message_role = "user"
        conversation.last_message_at = branched_at
        conversation.updated_at = branched_at
        completed_history = self.prepare_context(
            conversation,
            branch,
            head_message_id=edited_message.message_id,
            model=config.model,
        )
        db.add(conversation)
        db.commit()

        async for event in self._stream_assistant_generation(
            db,
            conversation,
            branch,
            assistant_message,
            config,
            completed_history,
            user_message_id=edited_message.message_id,
        ):
            yield event

    async def stream_regenerate_message(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> AsyncIterator[ChatSessionStreamEvent]:
        (
            conversation,
            branch,
            assistant_message,
            completed_history,
            move_branch_head,
        ) = self._prepare_regeneration(
            db,
            conversation_id,
            message_id,
            config,
            modified_nodes=modified_nodes,
        )
        async for event in self._stream_assistant_generation(
            db,
            conversation,
            branch,
            assistant_message,
            config,
            completed_history,
            user_message_id=assistant_message.parent_message_id,
            disable_cache=True,
            move_branch_head=move_branch_head,
        ):
            yield event

    async def send_message(
        self,
        db: Session,
        conversation_id: str,
        content: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> ChatConversation:
        conversation, branch, _, assistant_message, completed_history, _ = await self._prepare_send_generation(
            db,
            conversation_id,
            content,
            config,
            modified_nodes=modified_nodes,
        )

        await self._complete_assistant_generation(
            db,
            conversation,
            branch,
            assistant_message,
            config,
            completed_history,
        )

        return self.get_conversation(db, conversation_id)

    async def regenerate_message(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> ChatConversation:
        (
            conversation,
            branch,
            assistant_message,
            completed_history,
            move_branch_head,
        ) = self._prepare_regeneration(
            db,
            conversation_id,
            message_id,
            config,
            modified_nodes=modified_nodes,
        )

        await self._complete_assistant_generation(
            db,
            conversation,
            branch,
            assistant_message,
            config,
            completed_history,
            disable_cache=True,
            move_branch_head=move_branch_head,
        )

        return self.get_conversation(db, conversation_id)

    def select_message_variant(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        branch = self._get_or_create_active_branch(conversation)
        node_store = self.build_message_store(conversation)
        target_message = node_store.get(message_id)
        if target_message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {message_id}",
            )
        if target_message.role != "assistant":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only assistant messages can be selected as reply variants.",
            )

        branch.head_message_id = target_message.message_id
        if branch.base_message_id is None:
            flattened_path = self.flatten_from_message_id(conversation, target_message.message_id)
            branch.base_message_id = flattened_path[0].message_id if flattened_path else target_message.message_id
        conversation.last_message_preview = _message_preview(target_message.content_text)
        conversation.last_message_role = target_message.role
        conversation.last_message_at = target_message.created_at
        conversation.updated_at = _now()
        return self.repository.save(db, conversation)

    async def _prepare_send_generation(
        self,
        db: Session,
        conversation_id: str,
        content: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> tuple[
        ChatConversation,
        ChatBranch,
        ChatMessageRecord,
        ChatMessageRecord,
        list[ChatMessage],
        bool,
    ]:
        conversation = self.get_conversation(db, conversation_id)
        normalized_content = content.strip()
        if not normalized_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content is required.")

        branch = self._get_or_create_active_branch(conversation)
        branching_edit = self._apply_message_edits(conversation, modified_nodes or [])
        if branching_edit is not None:
            branch = await self._branch_from_non_leaf_edit(
                db,
                conversation,
                branching_edit.source_message,
                branching_edit.content,
                config,
                auto_generate_user_reply=branching_edit.source_message.role == "user",
            )

        next_seq = conversation.message_count
        user_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=next_seq + 1,
            role="user",
            content_text=normalized_content,
            parent_message_id=branch.head_message_id,
            status="completed",
        )
        assistant_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=next_seq + 2,
            role="assistant",
            content_text="",
            parent_message_id=user_message.message_id,
            status="pending",
            strategy=config.strategy,
        )

        sent_at = _now()
        if conversation.message_count == 0 and conversation.title_source == "auto":
            conversation.title = _build_title(normalized_content)
        conversation.draft_config = _normalize_config(config)
        conversation.messages.extend([user_message, assistant_message])
        if branch.base_message_id is None:
            branch.base_message_id = user_message.message_id
        branch.head_message_id = assistant_message.message_id
        conversation.message_count = next_seq + 2
        conversation.last_message_preview = _message_preview(normalized_content)
        conversation.last_message_role = "user"
        conversation.last_message_at = sent_at
        conversation.updated_at = sent_at
        completed_history = self.prepare_context(
            conversation,
            branch,
            head_message_id=user_message.message_id,
            model=config.model,
        )
        db.add(conversation)
        db.commit()
        return conversation, branch, user_message, assistant_message, completed_history, True

    def _prepare_regeneration(
        self,
        db: Session,
        conversation_id: str,
        message_id: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> tuple[
        ChatConversation,
        ChatBranch,
        ChatMessageRecord,
        list[ChatMessage],
        bool,
    ]:
        conversation = self.get_conversation(db, conversation_id)
        branch = self._get_or_create_active_branch(conversation)
        branching_edit = self._apply_message_edits(conversation, modified_nodes or [])
        if branching_edit is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Non-leaf edits open a new branch directly; please continue from that branch instead of combining with regenerate.",
            )

        node_store = self.build_message_store(conversation)
        source_message = node_store.get(message_id)
        if source_message is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Message node not found: {message_id}",
            )
        if source_message.role != "assistant":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Only assistant messages can be regenerated.",
            )
        if not source_message.parent_message_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Assistant message must have a parent node to regenerate.",
            )
        move_branch_head = branch.head_message_id == source_message.message_id
        assistant_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=conversation.message_count + 1,
            role="assistant",
            content_text="",
            parent_message_id=source_message.parent_message_id,
            status="pending",
            strategy=config.strategy,
        )
        sent_at = _now()
        conversation.draft_config = _normalize_config(config)
        conversation.messages.append(assistant_message)
        if branch.base_message_id is None:
            flattened_parent_path = self.flatten_from_message_id(conversation, source_message.parent_message_id)
            branch.base_message_id = (
                flattened_parent_path[0].message_id if flattened_parent_path else source_message.parent_message_id
            )
        conversation.message_count += 1
        if move_branch_head:
            branch.head_message_id = assistant_message.message_id
            conversation.last_message_preview = _message_preview(source_message.content_text)
            conversation.last_message_role = "assistant"
            conversation.last_message_at = sent_at
            conversation.updated_at = sent_at
        else:
            self._sync_active_branch_summary(conversation, branch)
        completed_history = self.prepare_context(
            conversation,
            branch,
            head_message_id=source_message.parent_message_id,
            model=config.model,
        )
        db.add(conversation)
        db.commit()
        return conversation, branch, assistant_message, completed_history, move_branch_head

    async def _stream_assistant_generation(
        self,
        db: Session,
        conversation: ChatConversation,
        branch: ChatBranch,
        assistant_message: ChatMessageRecord,
        config: ChatConversationConfig,
        completed_history: Sequence[ChatMessage],
        *,
        user_message_id: str | None = None,
        disable_cache: bool = False,
        move_branch_head: bool = True,
    ) -> AsyncIterator[ChatSessionStreamEvent]:
        cancel_event = asyncio.Event()
        self._active_generations[assistant_message.message_id] = cancel_event
        yield ChatSessionStreamEvent(
            kind="message.created",
            assistant_message_id=assistant_message.message_id,
            user_message_id=user_message_id,
            branch_id=branch.branch_id,
        )

        gateway_request = ChatCompletionRequest(
            model=config.model.strip(),
            messages=list(completed_history),
            temperature=config.temperature,
            prompt_id=config.prompt_id.strip() or None,
            prompt_variables=config.variables,
            strategy=config.strategy,
            disable_cache=disable_cache,
            stream=True,
        )

        try:
            stream_session = await gateway_service.begin_chat_stream(
                db,
                gateway_request,
                cancel_event=cancel_event,
            )
        except HTTPException as exc:
            request_id = exc.headers.get("X-Request-ID") if exc.headers else None
            request_log = self.request_logs.get_by_request_id(db, request_id) if request_id else None
            error_message = _stringify_error(exc.detail)
            final_conversation = self._finalize_assistant_generation_state(
                db,
                conversation,
                branch,
                assistant_message,
                content=f"调用失败：{error_message}",
                status="error",
                finish_reason="error",
                request_log_id=request_log.id if request_log else None,
                error_message=error_message,
                move_branch_head=move_branch_head,
            )
            yield ChatSessionStreamEvent(
                kind="message.error",
                assistant_message_id=assistant_message.message_id,
                error_message=error_message,
                conversation=final_conversation,
            )
            self._active_generations.pop(assistant_message.message_id, None)
            return

        yield ChatSessionStreamEvent(
            kind="message.meta",
            assistant_message_id=assistant_message.message_id,
            meta=ChatSessionStreamMeta(
                request_id=stream_session.call_info.request_id,
                provider=stream_session.call_info.provider,
                model=stream_session.call_info.model,
                route_reason=stream_session.call_info.route_reason,
                cache_hit=stream_session.call_info.cache_hit,
                endpoint_id=stream_session.call_info.endpoint_id,
                fallback_count=stream_session.call_info.fallback_count,
                strategy=stream_session.call_info.strategy,
            ),
        )

        try:
            async for result in gateway_service.iterate_chat_stream(db, stream_session):
                if result.kind == "delta":
                    assistant_message.content_text = result.content
                    yield ChatSessionStreamEvent(
                        kind="message.delta",
                        assistant_message_id=assistant_message.message_id,
                        delta=result.delta,
                        content=result.content,
                    )
                    continue

                if result.kind == "completed":
                    final_conversation = self._finalize_assistant_generation_state(
                        db,
                        conversation,
                        branch,
                        assistant_message,
                        content=result.content,
                        status="completed",
                        finish_reason=result.finish_reason or "stop",
                        request_log_id=result.request_log_id,
                        error_message=None,
                        move_branch_head=move_branch_head,
                    )
                    yield ChatSessionStreamEvent(
                        kind="message.completed",
                        assistant_message_id=assistant_message.message_id,
                        conversation=final_conversation,
                    )
                    continue

                if result.kind == "cancelled":
                    final_conversation = self._finalize_assistant_generation_state(
                        db,
                        conversation,
                        branch,
                        assistant_message,
                        content=result.content,
                        status="stopped",
                        finish_reason="cancelled",
                        request_log_id=result.request_log_id,
                        error_message=None,
                        move_branch_head=move_branch_head,
                    )
                    yield ChatSessionStreamEvent(
                        kind="message.stopped",
                        assistant_message_id=assistant_message.message_id,
                        conversation=final_conversation,
                    )
                    continue

                error_content = result.content or f"调用失败：{result.error_message or '未知错误'}"
                final_conversation = self._finalize_assistant_generation_state(
                    db,
                    conversation,
                    branch,
                    assistant_message,
                    content=error_content,
                    status="error",
                    finish_reason="error",
                    request_log_id=result.request_log_id,
                    error_message=result.error_message,
                    move_branch_head=move_branch_head,
                )
                yield ChatSessionStreamEvent(
                    kind="message.error",
                    assistant_message_id=assistant_message.message_id,
                    error_message=result.error_message,
                    conversation=final_conversation,
                )
        finally:
            self._active_generations.pop(assistant_message.message_id, None)

    def _finalize_assistant_generation_state(
        self,
        db: Session,
        conversation: ChatConversation,
        branch: ChatBranch,
        assistant_message: ChatMessageRecord,
        *,
        content: str,
        status: str,
        finish_reason: str,
        request_log_id: int | None,
        error_message: str | None,
        move_branch_head: bool,
    ) -> ChatConversation:
        assistant_message.content_text = content
        assistant_message.version = _message_version(assistant_message) + 1
        assistant_message.status = status
        assistant_message.finish_reason = finish_reason
        assistant_message.request_log_id = request_log_id
        assistant_message.error_message = error_message
        completed_at = _now()
        conversation.updated_at = completed_at
        if move_branch_head:
            self._append_message_to_branch_cache(branch, assistant_message)
            conversation.last_message_preview = _message_preview(assistant_message.content_text)
            conversation.last_message_role = "assistant"
            conversation.last_message_at = completed_at
            branch.head_message_id = assistant_message.message_id
        db.add(conversation)
        db.commit()
        return self.get_conversation(db, conversation.conversation_id)

    async def _complete_assistant_generation(
        self,
        db: Session,
        conversation: ChatConversation,
        branch: ChatBranch,
        assistant_message: ChatMessageRecord,
        config: ChatConversationConfig,
        completed_history: Sequence[ChatMessage],
        *,
        disable_cache: bool = False,
        move_branch_head: bool = True,
    ) -> None:
        gateway_request = ChatCompletionRequest(
            model=config.model.strip(),
            messages=list(completed_history),
            temperature=config.temperature,
            prompt_id=config.prompt_id.strip() or None,
            prompt_variables=config.variables,
            strategy=config.strategy,
            disable_cache=disable_cache,
            stream=False,
        )

        try:
            result = await gateway_service.handle_chat(db, gateway_request)
            self._finalize_assistant_generation_state(
                db,
                conversation,
                branch,
                assistant_message,
                content=result.response.choices[0].message.content,
                status="completed",
                finish_reason=result.response.choices[0].finish_reason,
                request_log_id=result.request_log_id,
                error_message=None,
                move_branch_head=move_branch_head,
            )
        except HTTPException as exc:
            request_id = exc.headers.get("X-Request-ID") if exc.headers else None
            request_log = self.request_logs.get_by_request_id(db, request_id) if request_id else None
            error_message = _stringify_error(exc.detail)
            self._finalize_assistant_generation_state(
                db,
                conversation,
                branch,
                assistant_message,
                content=f"调用失败：{error_message}",
                status="error",
                finish_reason="error",
                request_log_id=request_log.id if request_log else None,
                error_message=error_message,
                move_branch_head=move_branch_head,
            )

    def build_context_view(
        self,
        conversation: ChatConversation,
        branch: ChatBranch,
        *,
        head_message_id: str | None = None,
    ) -> list[ChatMessage]:
        target_head_message_id = head_message_id if head_message_id is not None else branch.head_message_id
        if not target_head_message_id:
            return []

        cached_path = self._get_valid_cached_path(conversation, branch, target_head_message_id)
        if cached_path is None:
            return self._walk_to_context_messages(conversation, target_head_message_id)

        context_messages: list[ChatMessage] = []
        for entry in cached_path:
            role = "system" if str(entry.get("role", "")) == "summary" else str(entry.get("role", ""))
            if role not in {"assistant", "system", "tool", "user"}:
                continue
            context_messages.append(ChatMessage(role=role, content=str(entry.get("content", ""))))
        return context_messages

    def flatten_visible_messages(
        self,
        conversation: ChatConversation,
        branch: ChatBranch,
        *,
        head_message_id: str | None = None,
    ) -> list[VisibleMessageResponse]:
        target_head_message_id = head_message_id if head_message_id is not None else branch.head_message_id
        if not target_head_message_id:
            return []

        cached_path = self._get_valid_cached_path(conversation, branch, target_head_message_id)
        if cached_path is None:
            source_messages = self.flatten_from_message_id(conversation, target_head_message_id)
            return [self._node_to_visible_message(message) for message in source_messages]

        visible_messages: list[VisibleMessageResponse] = []
        summary_index = 0
        source_node_ids_for_summary: list[str] = []
        if branch.compressed_source_versions_json:
            try:
                parsed = json.loads(branch.compressed_source_versions_json)
                if isinstance(parsed, dict):
                    source_node_ids_for_summary = [str(k) for k in parsed.keys()]
            except (TypeError, ValueError):
                source_node_ids_for_summary = []
        for entry in cached_path:
            node_id = str(entry.get("node_id", ""))
            role = str(entry.get("role", "assistant"))
            content = str(entry.get("content", ""))
            timestamp_value = entry.get("timestamp")
            timestamp = int(timestamp_value) if isinstance(timestamp_value, (int, float)) else None
            if role == "summary" or not node_id:
                visible_messages.append(
                    VisibleMessageResponse(
                        virtual_id=f"summary:{branch.branch_id}:{target_head_message_id}:{summary_index}",
                        kind="summary",
                        role="summary",
                        content=content,
                        source_node_id=None,
                        source_node_ids=source_node_ids_for_summary if source_node_ids_for_summary else None,
                        timestamp=timestamp,
                    )
                )
                summary_index += 1
                continue

            visible_messages.append(
                VisibleMessageResponse(
                    virtual_id=node_id,
                    kind="node",
                    role=role,
                    content=content,
                    source_node_id=node_id,
                    timestamp=timestamp,
                )
            )
        return visible_messages

    def _node_to_visible_message(self, message: ChatMessageRecord) -> VisibleMessageResponse:
        return VisibleMessageResponse(
            virtual_id=message.message_id,
            kind="node",
            role=message.role,
            content=message.content_text,
            source_node_id=message.message_id,
            timestamp=_to_millis(message.created_at),
        )

    def _walk_to_context_messages(
        self,
        conversation: ChatConversation,
        head_message_id: str,
    ) -> list[ChatMessage]:
        source_messages = self.flatten_from_message_id(conversation, head_message_id)
        completed_history: list[ChatMessage] = []
        for message in source_messages:
            if message.archived or message.status != "completed":
                continue
            role = "system" if message.role == "summary" else message.role
            if role in {"assistant", "system", "tool", "user"}:
                completed_history.append(ChatMessage(role=role, content=message.content_text))
        return completed_history

    def _estimate_message_tokens(self, message: ChatMessageRecord) -> int:
        return approximate_tokens(message.content_text.strip()) + 4

    def _resolve_context_window_tokens(self, model: str) -> int:
        normalized_model = model.strip().lower()
        if not normalized_model:
            return MEDIUM_CONTEXT_PROFILE.window_tokens

        known_window = KNOWN_MODEL_WINDOWS.get(normalized_model)
        if known_window is not None:
            return known_window

        if normalized_model.endswith("1m") or "-1m" in normalized_model:
            return 1_000_000

        compact_model = normalized_model.replace(" ", "")
        for suffix, multiplier in (("k", 1_000), ("m", 1_000_000)):
            marker_index = compact_model.rfind(suffix)
            if marker_index <= 0:
                continue

            digit_start = marker_index - 1
            while digit_start >= 0 and compact_model[digit_start].isdigit():
                digit_start -= 1
            token_str = compact_model[digit_start + 1 : marker_index]
            if token_str.isdigit():
                return int(token_str) * multiplier

        return MEDIUM_CONTEXT_PROFILE.window_tokens

    def _resolve_compression_profile(self, model: str) -> ContextCompressionProfile:
        window_tokens = self._resolve_context_window_tokens(model)
        if window_tokens <= SMALL_CONTEXT_PROFILE.window_tokens:
            return ContextCompressionProfile(
                window_tokens=window_tokens,
                trigger_ratio=SMALL_CONTEXT_PROFILE.trigger_ratio,
                compression_ratio=SMALL_CONTEXT_PROFILE.compression_ratio,
            )
        if window_tokens <= MEDIUM_CONTEXT_PROFILE.window_tokens:
            return ContextCompressionProfile(
                window_tokens=window_tokens,
                trigger_ratio=MEDIUM_CONTEXT_PROFILE.trigger_ratio,
                compression_ratio=MEDIUM_CONTEXT_PROFILE.compression_ratio,
            )
        return ContextCompressionProfile(
            window_tokens=window_tokens,
            trigger_ratio=LARGE_CONTEXT_PROFILE.trigger_ratio,
            compression_ratio=LARGE_CONTEXT_PROFILE.compression_ratio,
        )

    def _build_summary_text(self, nodes: Sequence[ChatMessageRecord]) -> str:
        role_labels = {
            "assistant": "助手",
            "summary": "摘要",
            "system": "系统",
            "tool": "工具",
            "user": "用户",
        }
        lines = ["历史摘要（已压缩的较早上下文）："]
        for node in nodes:
            normalized_content = " ".join(node.content_text.strip().split())
            if not normalized_content:
                continue

            excerpt = normalized_content[:180]
            if len(normalized_content) > 180:
                excerpt = f"{excerpt}…"
            lines.append(f"- {role_labels.get(node.role, node.role)}：{excerpt}")

        if len(lines) == 1:
            lines.append("- 该段上下文已压缩。")

        return "\n".join(lines)

    def prepare_context(
        self,
        conversation: ChatConversation,
        branch: ChatBranch,
        *,
        head_message_id: str | None,
        model: str,
    ) -> list[ChatMessage]:
        if not head_message_id:
            return []
        profile = self._resolve_compression_profile(model)
        completed_history = self.build_context_view(conversation, branch, head_message_id=head_message_id)
        total_tokens = sum(approximate_tokens(str(message.content or "").strip()) + 4 for message in completed_history)
        trigger_tokens = int(profile.window_tokens * profile.trigger_ratio)
        if total_tokens < trigger_tokens:
            return completed_history

        self.compress_context(
            conversation,
            branch,
            head_message_id=head_message_id,
            compression_ratio=profile.compression_ratio,
        )
        return self.build_context_view(conversation, branch, head_message_id=head_message_id)

    def compress_context(
        self,
        conversation: ChatConversation,
        branch: ChatBranch,
        *,
        head_message_id: str,
        compression_ratio: float,
    ) -> None:
        full_path = self._walk_to_nodes(conversation, head_message_id)
        if len(full_path) <= 1:
            return

        compress_start: int | None = None
        compress_end: int | None = None
        for index, node in enumerate(full_path):
            if node.pinned or node.role == "summary":
                if compress_start is not None:
                    break
                continue
            if compress_start is None:
                compress_start = index
            compress_end = index

        if compress_start is None or compress_end is None:
            return

        compressible_count = compress_end - compress_start + 1
        cut = max(1, math.ceil(compressible_count * compression_ratio))
        actual_end = min(len(full_path), compress_start + cut)
        to_compress = full_path[compress_start:actual_end]
        if not to_compress:
            return

        cached_path: list[dict[str, object]] = []
        for node in full_path[:compress_start]:
            cached_path.append(self._cached_path_entry_for_node(node))

        cached_path.append(
            {
                "node_id": "",
                "role": "summary",
                "content": self._build_summary_text(to_compress),
                "version": 0,
                "timestamp": _to_millis(to_compress[-1].created_at),
            }
        )

        for node in full_path[actual_end:]:
            cached_path.append(self._cached_path_entry_for_node(node))

        branch.compressed_path_json = json.dumps(cached_path, ensure_ascii=False)
        branch.compressed_at_head_message_id = head_message_id
        branch.compressed_source_versions_json = json.dumps(
            {node.message_id: _message_version(node) for node in to_compress},
            ensure_ascii=False,
        )

    def _cached_path_entry_for_node(self, message: ChatMessageRecord) -> dict[str, object]:
        return {
            "node_id": message.message_id,
            "role": message.role,
            "content": message.content_text,
            "version": _message_version(message),
            "timestamp": _to_millis(message.created_at),
        }

    def _get_valid_cached_path(
        self,
        conversation: ChatConversation,
        branch: ChatBranch,
        head_message_id: str,
    ) -> list[dict[str, object]] | None:
        if not branch.compressed_path_json:
            return None
        if branch.compressed_at_head_message_id != head_message_id:
            self._invalidate_branch_cache(branch)
            return None

        try:
            cached_path = json.loads(branch.compressed_path_json)
        except json.JSONDecodeError:
            self._invalidate_branch_cache(branch)
            return None

        if not isinstance(cached_path, list):
            self._invalidate_branch_cache(branch)
            return None

        node_store = self.build_message_store(conversation)
        if not self._survivors_valid(node_store, cached_path):
            self._invalidate_branch_cache(branch)
            return None

        if branch.compressed_source_versions_json:
            try:
                source_versions = json.loads(branch.compressed_source_versions_json)
            except json.JSONDecodeError:
                self._invalidate_branch_cache(branch)
                return None
            if not isinstance(source_versions, dict) or not self._sources_valid(node_store, source_versions):
                self._invalidate_branch_cache(branch)
                return None

        return cached_path

    def _survivors_valid(
        self,
        node_store: dict[str, ChatMessageRecord],
        cached_path: Sequence[dict[str, object]],
    ) -> bool:
        for entry in cached_path:
            node_id = str(entry.get("node_id", ""))
            if not node_id:
                continue
            node = node_store.get(node_id)
            if node is None:
                return False
            cached_version = entry.get("version", -1)
            if not isinstance(cached_version, (int, float, str)):
                return False
            if _message_version(node) != int(cached_version):
                return False
        return True

    def _sources_valid(
        self,
        node_store: dict[str, ChatMessageRecord],
        source_versions: dict[str, object],
    ) -> bool:
        for node_id, cached_version in source_versions.items():
            node = node_store.get(str(node_id))
            if node is None:
                return False
            if not isinstance(cached_version, (int, float, str)):
                return False
            if _message_version(node) != int(cached_version):
                return False
        return True

    def _invalidate_branch_cache(self, branch: ChatBranch) -> None:
        branch.compressed_path_json = None
        branch.compressed_at_head_message_id = None
        branch.compressed_source_versions_json = None

    def _append_message_to_branch_cache(
        self,
        branch: ChatBranch,
        message: ChatMessageRecord,
    ) -> None:
        if not branch.compressed_path_json or not message.parent_message_id:
            return
        if branch.compressed_at_head_message_id != message.parent_message_id:
            return
        try:
            cached_path = json.loads(branch.compressed_path_json)
        except json.JSONDecodeError:
            self._invalidate_branch_cache(branch)
            return
        if not isinstance(cached_path, list):
            self._invalidate_branch_cache(branch)
            return

        cached_path.append(self._cached_path_entry_for_node(message))
        branch.compressed_path_json = json.dumps(cached_path, ensure_ascii=False)
        branch.compressed_at_head_message_id = message.message_id

    def _walk_to_nodes(
        self,
        conversation: ChatConversation,
        head_message_id: str,
    ) -> list[ChatMessageRecord]:
        return self.flatten_from_message_id(conversation, head_message_id)

    def _resolve_branch_name(self, conversation: ChatConversation, name: str | None) -> str:
        normalized_name = " ".join((name or "").strip().split())
        if normalized_name:
            if any(branch.name == normalized_name for branch in conversation.branches):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Branch name already exists: {normalized_name}",
                )
            return normalized_name

        existing_names = {branch.name for branch in conversation.branches}
        next_index = 2
        while True:
            candidate = f"branch-{next_index}"
            if candidate not in existing_names:
                return candidate
            next_index += 1

    def _sync_active_branch_summary(
        self,
        conversation: ChatConversation,
        branch: ChatBranch,
    ) -> None:
        conversation.updated_at = _now()
        if not branch.head_message_id:
            conversation.last_message_preview = None
            conversation.last_message_role = None
            conversation.last_message_at = None
            return

        node_store = self.build_message_store(conversation)
        head_message = node_store.get(branch.head_message_id)
        if head_message is None:
            conversation.last_message_preview = None
            conversation.last_message_role = None
            conversation.last_message_at = None
            return

        conversation.last_message_preview = _message_preview(head_message.content_text)
        conversation.last_message_role = head_message.role
        conversation.last_message_at = head_message.created_at

    def _message_has_visible_children(
        self,
        conversation: ChatConversation,
        message_id: str,
    ) -> bool:
        return any(
            message.parent_message_id == message_id and not message.archived
            for message in conversation.messages
        )

    def _build_branch_base_message_id(
        self,
        conversation: ChatConversation,
        message_id: str,
    ) -> str:
        flattened_path = self.flatten_from_message_id(conversation, message_id)
        if flattened_path:
            return flattened_path[0].message_id
        return message_id

    def _create_edited_message_variant(
        self,
        conversation: ChatConversation,
        source_message: ChatMessageRecord,
        content: str,
    ) -> ChatMessageRecord:
        edited_message = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=conversation.message_count + 1,
            role=source_message.role,
            content_text=content,
            parent_message_id=source_message.parent_message_id,
            modified_from_message_id=source_message.message_id,
            pinned=source_message.pinned,
            archived=False,
            stale=False,
            status="completed",
        )
        conversation.messages.append(edited_message)
        conversation.message_count += 1
        return edited_message

    async def _branch_from_non_leaf_edit(
        self,
        db: Session,
        conversation: ChatConversation,
        source_message: ChatMessageRecord,
        content: str,
        config: ChatConversationConfig,
        *,
        auto_generate_user_reply: bool,
    ) -> ChatBranch:
        edited_message = self._create_edited_message_variant(conversation, source_message, content)
        branch = ChatBranch(
            branch_id=_next_branch_id(),
            name=self._resolve_branch_name(conversation, None),
            head_message_id=edited_message.message_id,
            base_message_id=self._build_branch_base_message_id(conversation, edited_message.message_id),
        )
        conversation.branches.append(branch)
        conversation.active_branch_id = branch.branch_id
        conversation.draft_config = _normalize_config(config)
        branched_at = _now()
        conversation.last_message_preview = _message_preview(edited_message.content_text)
        conversation.last_message_role = edited_message.role
        conversation.last_message_at = branched_at
        conversation.updated_at = branched_at

        if auto_generate_user_reply and edited_message.role == "user":
            assistant_message = ChatMessageRecord(
                message_id=_next_message_id(),
                seq=conversation.message_count + 1,
                role="assistant",
                content_text="",
                parent_message_id=edited_message.message_id,
                status="pending",
                strategy=config.strategy,
            )
            conversation.messages.append(assistant_message)
            conversation.message_count += 1
            branch.head_message_id = assistant_message.message_id
            conversation.last_message_preview = _message_preview(edited_message.content_text)
            conversation.last_message_role = "user"
            conversation.last_message_at = branched_at

            completed_history = self.prepare_context(
                conversation,
                branch,
                head_message_id=edited_message.message_id,
                model=config.model,
            )
            db.add(conversation)
            db.commit()

            await self._complete_assistant_generation(
                db,
                conversation,
                branch,
                assistant_message,
                config,
                completed_history,
            )
            return branch

        return branch

    def _apply_message_edits(
        self,
        conversation: ChatConversation,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit],
    ) -> BranchingEdit | None:
        if not modified_nodes:
            return None

        node_store = self.build_message_store(conversation)
        branching_edit: BranchingEdit | None = None

        for modified_node in modified_nodes:
            node = node_store.get(modified_node.id)
            if node is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Message node not found: {modified_node.id}",
                )

            normalized_content = modified_node.content.strip()
            if not normalized_content:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Message content is required for node {modified_node.id}.",
                )

            if normalized_content == node.content_text:
                continue

            if self._message_has_visible_children(conversation, node.message_id):
                if branching_edit is not None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="Only one non-leaf message edit can be committed at a time.",
                    )
                if len(modified_nodes) > 1:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="Non-leaf edits must be committed on their own.",
                    )
                branching_edit = BranchingEdit(content=normalized_content, source_message=node)
                continue

            node.content_text = normalized_content
            node.version = _message_version(node) + 1

        return branching_edit

    def _select_branch(
        self,
        conversation: ChatConversation,
        branch_id: str | None,
    ) -> ChatBranch | None:
        if branch_id:
            for branch in conversation.branches:
                if branch.branch_id == branch_id:
                    return branch
        return self.get_active_branch(conversation)

    def _get_or_create_active_branch(self, conversation: ChatConversation) -> ChatBranch:
        branch = self.get_active_branch(conversation)
        if branch:
            return branch

        branch = ChatBranch(
            branch_id=_next_branch_id(),
            name="main",
            head_message_id=None,
            base_message_id=None,
        )
        conversation.branches.append(branch)
        conversation.active_branch_id = branch.branch_id
        return branch

    def _ensure_graph_state(self, conversation: ChatConversation) -> bool:
        changed = False
        ordered_messages = self._ordered_messages(conversation.messages)
        known_message_ids = {message.message_id for message in ordered_messages if message.message_id}
        main_branch = self.get_active_branch(conversation)
        legacy_linear = self._looks_like_legacy_linear_chain(ordered_messages)

        if not conversation.branches:
            main_branch = ChatBranch(
                branch_id=_next_branch_id(),
                name="main",
                head_message_id=None,
                base_message_id=None,
            )
            conversation.branches.append(main_branch)
            conversation.active_branch_id = main_branch.branch_id
            changed = True
        elif conversation.active_branch_id is None and main_branch is not None:
            conversation.active_branch_id = main_branch.branch_id
            changed = True

        if ordered_messages and legacy_linear:
            previous_id: str | None = None
            for message in ordered_messages:
                if message.parent_message_id != previous_id:
                    message.parent_message_id = previous_id
                    changed = True
                previous_id = message.message_id

        main_branch = self.get_active_branch(conversation)
        if main_branch is not None:
            head_message_id = ordered_messages[-1].message_id if ordered_messages else None
            base_message_id = ordered_messages[0].message_id if ordered_messages else None

            if head_message_id is not None and (
                (legacy_linear and main_branch.head_message_id != head_message_id)
                or main_branch.head_message_id is None
                or main_branch.head_message_id not in known_message_ids
            ):
                main_branch.head_message_id = head_message_id
                changed = True

            if main_branch.base_message_id is None and base_message_id is not None:
                main_branch.base_message_id = base_message_id
                changed = True

        return changed

    def _looks_like_legacy_linear_chain(self, messages: Sequence[ChatMessageRecord]) -> bool:
        if len(messages) <= 1:
            return False
        return all(not message.parent_message_id for message in messages[1:])

    def _ordered_messages(self, messages: Sequence[ChatMessageRecord]) -> list[ChatMessageRecord]:
        return sorted(messages, key=lambda message: (message.seq, message.created_at, message.id))


chat_session_service = ChatSessionService()
