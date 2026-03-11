from __future__ import annotations

import json
from typing import Any

from app.schemas.chat import ChatMessage, ChatMessageContentPart


def normalize_message_content(content: str | list[ChatMessageContentPart] | None) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    return "\n".join(part.text or "" for part in content if part.type == "text")


def approximate_tokens(text: str) -> int:
    return max(1, len(text) // 4) if text else 0


def messages_cache_blob(messages: list[ChatMessage]) -> str:
    normalized = [
        {"role": message.role, "content": normalize_message_content(message.content)}
        for message in messages
    ]
    return json.dumps(normalized, ensure_ascii=False, sort_keys=True)


def safe_format(template: str, values: dict[str, Any]) -> str:
    class SafeDict(dict):
        def __missing__(self, key: str) -> str:
            raise KeyError(key)

    return template.format_map(SafeDict(values))

