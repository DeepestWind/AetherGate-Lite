from collections.abc import Sequence

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.request_log import RequestLog


class RequestLogRepository:
    def get_by_request_id(self, db: Session, request_id: str | None) -> RequestLog | None:
        if not request_id:
            return None
        stmt = select(RequestLog).where(RequestLog.request_id == request_id)
        return db.scalar(stmt)

    def save(self, db: Session, request_log: RequestLog) -> RequestLog:
        db.add(request_log)
        db.commit()
        db.refresh(request_log)
        return request_log

    def list(self, db: Session, stmt: Select[tuple[RequestLog]]) -> Sequence[RequestLog]:
        return db.scalars(stmt).all()

    def base_stmt(self):
        return select(RequestLog).order_by(RequestLog.timestamp.desc(), RequestLog.id.desc())
