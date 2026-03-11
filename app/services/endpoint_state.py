from __future__ import annotations

import time


class EndpointStateTracker:
    def __init__(self, threshold: int, cooldown_seconds: int):
        self.threshold = threshold
        self.cooldown_seconds = cooldown_seconds
        self._state: dict[int, dict[str, float | int]] = {}

    def is_available(self, endpoint_id: int) -> bool:
        state = self._state.get(endpoint_id)
        if not state:
            return True
        cooldown_until = float(state.get("cooldown_until", 0))
        if cooldown_until and cooldown_until > time.time():
            return False
        if cooldown_until:
            state["cooldown_until"] = 0
        return True

    def record_failure(self, endpoint_id: int) -> None:
        state = self._state.setdefault(endpoint_id, {"failures": 0, "cooldown_until": 0.0})
        state["failures"] = int(state["failures"]) + 1
        if int(state["failures"]) >= self.threshold:
            state["cooldown_until"] = time.time() + self.cooldown_seconds

    def record_success(self, endpoint_id: int) -> None:
        self._state.pop(endpoint_id, None)

