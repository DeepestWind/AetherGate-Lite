from __future__ import annotations

import json
import math
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.chat_session import ChatBranch, ChatConversation, ChatMessageRecord
from app.repositories.chat_sessions import ChatConversationRepository
from app.repositories.request_logs import RequestLogRepository
from app.schemas.chat import ChatCompletionRequest, ChatMessage
from app.schemas.chat_sessions import ChatConversationConfig, ChatConversationMessageNodeEdit
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


@dataclass(frozen=True, slots=True)
class ContextCompressionProfile:
    window_tokens: int
    trigger_ratio: float
    compression_ratio: float


@dataclass(frozen=True, slots=True)
class CompressionSegment:
    nodes: tuple[ChatMessageRecord, ...]
    start_index: int
    end_index: int


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
            source_messages = self.flatten_from_message_id(conversation, message_id)
        else:
            source_messages = self.flatten_messages(conversation, branch_id=branch_id)

        return self._records_to_completed_history(source_messages)

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

        message.pinned = pinned
        conversation.updated_at = _now()
        return self.repository.save(db, conversation)

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

    async def send_message(
        self,
        db: Session,
        conversation_id: str,
        content: str,
        config: ChatConversationConfig,
        *,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit] | None = None,
    ) -> ChatConversation:
        conversation = self.get_conversation(db, conversation_id)
        normalized_content = content.strip()
        if not normalized_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content is required.")

        branch = self._get_or_create_active_branch(conversation)
        self._apply_message_edits(conversation, modified_nodes or [])

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

        completed_history = self._maybe_compress_context(
            conversation,
            head_message_id=user_message.message_id,
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
        conversation = self.get_conversation(db, conversation_id)
        branch = self._get_or_create_active_branch(conversation)
        self._apply_message_edits(conversation, modified_nodes or [])

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

        completed_history = self._maybe_compress_context(
            conversation,
            head_message_id=source_message.parent_message_id,
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
            assistant_message.content_text = result.response.choices[0].message.content
            assistant_message.status = "completed"
            assistant_message.finish_reason = result.response.choices[0].finish_reason
            assistant_message.request_log_id = result.request_log_id
            assistant_message.error_message = None
            completed_at = _now()
            conversation.updated_at = completed_at
            if move_branch_head:
                conversation.last_message_preview = _message_preview(assistant_message.content_text)
                conversation.last_message_role = "assistant"
                conversation.last_message_at = completed_at
                branch.head_message_id = assistant_message.message_id
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
            completed_at = _now()
            conversation.updated_at = completed_at
            if move_branch_head:
                conversation.last_message_preview = _message_preview(assistant_message.content_text)
                conversation.last_message_role = "assistant"
                conversation.last_message_at = completed_at
                branch.head_message_id = assistant_message.message_id
            db.add(conversation)
            db.commit()

    def _records_to_completed_history(
        self,
        source_messages: Sequence[ChatMessageRecord],
    ) -> list[ChatMessage]:
        completed_history: list[ChatMessage] = []
        for message in source_messages:
            if message.archived or message.status != "completed":
                continue
            if message.role == "summary":
                completed_history.append(ChatMessage(role="system", content=message.content_text))
                continue
            if message.role in {"assistant", "system", "tool", "user"}:
                completed_history.append(ChatMessage(role=message.role, content=message.content_text))
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

    def _is_compression_anchor(
        self,
        message: ChatMessageRecord,
        *,
        path_index: int,
    ) -> bool:
        return path_index == 0 or message.pinned or message.role == "summary"

    def _select_compression_segment(
        self,
        path: Sequence[ChatMessageRecord],
        compression_ratio: float,
    ) -> CompressionSegment | None:
        if len(path) <= 1:
            return None

        target_count = min(len(path) - 1, max(1, math.ceil(len(path) * compression_ratio)))
        if target_count <= 0:
            return None

        segments: list[CompressionSegment] = []
        current_nodes: list[ChatMessageRecord] = []
        current_start: int | None = None

        for index, message in enumerate(path[:target_count]):
            if self._is_compression_anchor(message, path_index=index):
                if current_nodes:
                    segments.append(
                        CompressionSegment(
                            nodes=tuple(current_nodes),
                            start_index=current_start or 0,
                            end_index=index - 1,
                        )
                    )
                    current_nodes = []
                    current_start = None
                continue

            if current_start is None:
                current_start = index
            current_nodes.append(message)

        if current_nodes:
            segments.append(
                CompressionSegment(
                    nodes=tuple(current_nodes),
                    start_index=current_start or 0,
                    end_index=(current_start or 0) + len(current_nodes) - 1,
                )
            )

        if not segments:
            return None

        return max(
            segments,
            key=lambda segment: (
                sum(self._estimate_message_tokens(message) for message in segment.nodes),
                -segment.start_index,
            ),
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

    def _maybe_compress_context(
        self,
        conversation: ChatConversation,
        *,
        head_message_id: str | None,
        model: str,
    ) -> list[ChatMessage]:
        path = self.flatten_from_message_id(conversation, head_message_id)
        if len(path) <= 1:
            return self._records_to_completed_history(path)

        profile = self._resolve_compression_profile(model)
        total_tokens = sum(self._estimate_message_tokens(message) for message in path)
        trigger_tokens = int(profile.window_tokens * profile.trigger_ratio)
        if total_tokens < trigger_tokens:
            return self._records_to_completed_history(path)

        segment = self._select_compression_segment(path, profile.compression_ratio)
        if segment is None:
            return self._records_to_completed_history(path)

        anchor_node = path[segment.start_index - 1] if segment.start_index > 0 else None
        first_survivor_index = segment.end_index + 1
        if first_survivor_index >= len(path):
            return self._records_to_completed_history(path)

        summary_node = ChatMessageRecord(
            message_id=_next_message_id(),
            seq=conversation.message_count + 1,
            role="summary",
            content_text=self._build_summary_text(segment.nodes),
            parent_message_id=anchor_node.message_id if anchor_node else None,
            status="completed",
            pinned=True,
            archived=False,
            stale=False,
        )
        conversation.messages.append(summary_node)
        conversation.message_count += 1

        first_survivor = path[first_survivor_index]
        first_survivor.parent_message_id = summary_node.message_id

        for node in segment.nodes:
            node.archived = True

        compressed_path = self.flatten_from_message_id(conversation, head_message_id)
        return self._records_to_completed_history(compressed_path)

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

    def _apply_message_edits(
        self,
        conversation: ChatConversation,
        modified_nodes: Sequence[ChatConversationMessageNodeEdit],
    ) -> None:
        if not modified_nodes:
            return

        node_store = self.build_message_store(conversation)

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

            node.content_text = normalized_content

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
