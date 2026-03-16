from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.auth import require_bearer_token
from app.db.session import get_db
from app.schemas.internal import HealthResponse, LogsResponse, MetricsResponse, StatsResponse
from app.services.metrics import MetricsService

router = APIRouter(prefix="/internal", tags=["internal"])
metrics_service = MetricsService()


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return HealthResponse(
        status="ok",
        service="branchat",
        database="ok",
        timestamp=datetime.now(timezone.utc),
    )


@router.get(
    "/metrics",
    response_model=MetricsResponse,
    dependencies=[Depends(require_bearer_token)],
)
def metrics(db: Session = Depends(get_db)):
    return metrics_service.get_metrics(db)


@router.get(
    "/stats",
    response_model=StatsResponse,
    dependencies=[Depends(require_bearer_token)],
)
def stats(days: int = Query(default=7, ge=1, le=90), db: Session = Depends(get_db)):
    return metrics_service.get_stats(db, days)


@router.get(
    "/logs",
    response_model=LogsResponse,
    dependencies=[Depends(require_bearer_token)],
)
def logs(
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status: str | None = None,
    logical_model: str | None = None,
    prompt_id: str | None = None,
    cache_hit: bool | None = None,
    db: Session = Depends(get_db),
):
    return metrics_service.get_logs(db, limit, offset, status, logical_model, prompt_id, cache_hit)
