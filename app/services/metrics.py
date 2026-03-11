from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.endpoint import ModelEndpoint
from app.models.request_log import RequestLog
from app.schemas.internal import LogItem, LogsResponse, MetricsResponse, StatsPoint, StatsResponse


class MetricsService:
    def __init__(self):
        self.settings = get_settings()

    def get_metrics(self, db: Session) -> MetricsResponse:
        timezone = ZoneInfo(self.settings.timezone)
        start_of_day = datetime.now(timezone).replace(hour=0, minute=0, second=0, microsecond=0)
        start_utc = start_of_day.astimezone(ZoneInfo("UTC"))
        stmt = select(
            func.count(RequestLog.id),
            func.sum(case((RequestLog.status == "success", 1), else_=0)),
            func.sum(case((RequestLog.status != "success", 1), else_=0)),
            func.sum(case((RequestLog.cache_hit.is_(True), 1), else_=0)),
            func.sum(case((RequestLog.fallback_count > 0, 1), else_=0)),
            func.avg(RequestLog.latency_ms),
            func.sum(RequestLog.total_tokens),
            func.sum(RequestLog.cost_usd),
        ).where(RequestLog.timestamp >= start_utc)
        (
            total_requests,
            success_requests,
            failed_requests,
            cache_hits,
            fallback_requests,
            average_latency,
            total_tokens,
            total_cost,
        ) = db.execute(stmt).one()
        distribution_stmt = (
            select(RequestLog.logical_model, func.count(RequestLog.id))
            .where(RequestLog.timestamp >= start_utc)
            .group_by(RequestLog.logical_model)
            .order_by(func.count(RequestLog.id).desc(), RequestLog.logical_model.asc())
        )
        model_distribution = {
            logical_model: int(count or 0) for logical_model, count in db.execute(distribution_stmt).all()
        }
        total_requests_int = int(total_requests or 0)
        success_requests_int = int(success_requests or 0)
        cache_hits_int = int(cache_hits or 0)
        return MetricsResponse(
            total_requests=total_requests_int,
            success_requests=success_requests_int,
            failed_requests=int(failed_requests or 0),
            cache_hits=cache_hits_int,
            fallback_requests=int(fallback_requests or 0),
            cache_hit_rate=(cache_hits_int / total_requests_int) if total_requests_int else 0.0,
            success_rate=(success_requests_int / total_requests_int) if total_requests_int else 0.0,
            average_latency_ms=float(average_latency or 0.0),
            total_tokens=int(total_tokens or 0),
            total_cost_usd=float(total_cost or 0.0),
            model_distribution=model_distribution,
        )

    def get_stats(self, db: Session, days: int) -> StatsResponse:
        start = datetime.now(ZoneInfo("UTC")) - timedelta(days=max(days - 1, 0))
        stmt = (
            select(
                func.date(RequestLog.timestamp).label("bucket"),
                func.count(RequestLog.id),
                func.sum(case((RequestLog.status == "success", 1), else_=0)),
                func.sum(case((RequestLog.status != "success", 1), else_=0)),
                func.sum(case((RequestLog.cache_hit.is_(True), 1), else_=0)),
                func.sum(RequestLog.total_tokens),
                func.sum(RequestLog.cost_usd),
            )
            .where(RequestLog.timestamp >= start)
            .group_by("bucket")
            .order_by("bucket")
        )
        rows = db.execute(stmt).all()
        series = [
            StatsPoint(
                date=datetime.strptime(row[0], "%Y-%m-%d").date(),
                total_requests=int(row[1] or 0),
                success_requests=int(row[2] or 0),
                failed_requests=int(row[3] or 0),
                cache_hits=int(row[4] or 0),
                total_tokens=int(row[5] or 0),
                total_cost_usd=float(row[6] or 0.0),
            )
            for row in rows
        ]
        return StatsResponse(days=days, series=series)

    def get_logs(
        self,
        db: Session,
        limit: int,
        offset: int,
        status: str | None = None,
        logical_model: str | None = None,
        prompt_id: str | None = None,
        cache_hit: bool | None = None,
    ) -> LogsResponse:
        stmt = select(RequestLog).order_by(RequestLog.timestamp.desc(), RequestLog.id.desc())
        count_stmt = select(func.count(RequestLog.id))
        for column, value in (
            (RequestLog.status, status),
            (RequestLog.logical_model, logical_model),
            (RequestLog.prompt_id, prompt_id),
        ):
            if value is not None:
                stmt = stmt.where(column == value)
                count_stmt = count_stmt.where(column == value)
        if cache_hit is not None:
            stmt = stmt.where(RequestLog.cache_hit.is_(cache_hit))
            count_stmt = count_stmt.where(RequestLog.cache_hit.is_(cache_hit))

        total = int(db.scalar(count_stmt) or 0)
        items = db.scalars(stmt.offset(offset).limit(limit)).all()
        endpoint_ids = {item.endpoint_id for item in items if item.endpoint_id is not None}
        endpoint_map: dict[int, str] = {}
        if endpoint_ids:
            endpoint_stmt = select(ModelEndpoint).where(ModelEndpoint.id.in_(endpoint_ids))
            endpoint_map = {item.id: item.name for item in db.scalars(endpoint_stmt).all()}

        return LogsResponse(
            total=total,
            items=[
                LogItem(
                    request_id=item.request_id,
                    endpoint_id=item.endpoint_id,
                    endpoint_name=endpoint_map.get(item.endpoint_id) if item.endpoint_id else None,
                    logical_model=item.logical_model,
                    provider=item.provider,
                    actual_model=item.actual_model,
                    total_tokens=item.total_tokens,
                    cost_usd=item.cost_usd,
                    latency_ms=item.latency_ms,
                    cache_hit=item.cache_hit,
                    route_reason=item.route_reason,
                    status=item.status,
                    error_code=item.error_code,
                    prompt_id=item.prompt_id,
                    fallback_count=item.fallback_count,
                    timestamp=item.timestamp,
                )
                for item in items
            ],
        )
