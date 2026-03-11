from __future__ import annotations

import time


class TTLCache:
    def __init__(self, ttl_seconds: int):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, dict]] = {}

    def get(self, key: str) -> dict | None:
        entry = self._store.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at <= time.time():
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: dict) -> None:
        self._store[key] = (time.time() + self.ttl_seconds, value)

