from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.models.endpoint import ModelEndpoint
from app.repositories.endpoints import EndpointRepository
from app.services.endpoint_state import EndpointStateTracker


class RoutingService:
    def __init__(self, state_tracker: EndpointStateTracker):
        self.repository = EndpointRepository()
        self.state_tracker = state_tracker
        self._balanced_cursor: dict[str, int] = defaultdict(int)

    def choose_candidates(
        self,
        db: Session,
        logical_model: str,
        strategy: str,
        endpoint_id: int | None = None,
    ) -> tuple[list[ModelEndpoint], str]:
        candidates = list(self.repository.list_enabled(db, logical_model))
        if strategy == "designated":
            if endpoint_id is None:
                raise ValueError("strategy=designated requires endpoint_id.")
            designated = next((item for item in candidates if item.id == endpoint_id), None)
            if not designated:
                raise ValueError("Designated endpoint is not available.")
            remaining = [item for item in candidates if item.id != endpoint_id]
            ordered = [designated, *self._sort_by_priority(remaining)]
            return self._prioritize_available(ordered), f"designated:{designated.name}"

        ordered = self._sort_by_priority(candidates)
        if not ordered:
            return [], "balanced"
        offset = self._balanced_cursor[logical_model] % len(ordered)
        self._balanced_cursor[logical_model] += 1
        rotated = ordered[offset:] + ordered[:offset]
        return self._prioritize_available(rotated), "balanced"

    def _sort_by_priority(self, candidates: Sequence[ModelEndpoint]) -> list[ModelEndpoint]:
        return sorted(
            candidates,
            key=lambda item: (item.priority, -(item.is_valid or False), item.id),
        )

    def _prioritize_available(self, ordered: list[ModelEndpoint]) -> list[ModelEndpoint]:
        available = [item for item in ordered if self.state_tracker.is_available(item.id)]
        return available or ordered
