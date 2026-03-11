from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.endpoint import ModelEndpoint


class EndpointRepository:
    def list(self, db: Session) -> Sequence[ModelEndpoint]:
        stmt = select(ModelEndpoint).order_by(
            ModelEndpoint.logical_model.asc(),
            ModelEndpoint.priority.asc(),
            ModelEndpoint.id.asc(),
        )
        return db.scalars(stmt).all()

    def list_enabled(self, db: Session, logical_model: str | None = None) -> Sequence[ModelEndpoint]:
        stmt = select(ModelEndpoint).where(ModelEndpoint.is_enabled.is_(True))
        if logical_model:
            stmt = stmt.where(ModelEndpoint.logical_model == logical_model)
        stmt = stmt.order_by(
            ModelEndpoint.priority.asc(),
            ModelEndpoint.weight.desc(),
            ModelEndpoint.id.asc(),
        )
        return db.scalars(stmt).all()

    def get(self, db: Session, endpoint_id: int) -> ModelEndpoint | None:
        return db.get(ModelEndpoint, endpoint_id)

    def get_by_name(self, db: Session, name: str) -> ModelEndpoint | None:
        stmt = select(ModelEndpoint).where(ModelEndpoint.name == name)
        return db.scalar(stmt)

    def get_by_logical_model(self, db: Session, logical_model: str) -> Sequence[ModelEndpoint]:
        stmt = (
            select(ModelEndpoint)
            .where(ModelEndpoint.logical_model == logical_model)
            .order_by(ModelEndpoint.priority.asc(), ModelEndpoint.id.asc())
        )
        return db.scalars(stmt).all()

    def save(self, db: Session, endpoint: ModelEndpoint) -> ModelEndpoint:
        db.add(endpoint)
        db.commit()
        db.refresh(endpoint)
        return endpoint

    def delete(self, db: Session, endpoint: ModelEndpoint) -> None:
        db.delete(endpoint)
        db.commit()

