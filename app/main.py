from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.api.routes_chat_sessions import router as chat_sessions_router
from app.api.routes_endpoints import router as endpoints_router
from app.api.routes_gateway import router as gateway_router
from app.api.routes_internal import router as internal_router
from app.api.routes_prompts import router as prompts_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.schema_compat import ensure_schema_compatibility
from app.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    configure_logging(settings)
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility(engine)
    yield


settings = get_settings()
project_root = Path(__file__).resolve().parents[1]
frontend_dist = project_root / "frontend" / "console" / "dist"
app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.include_router(gateway_router)
app.include_router(internal_router)
app.include_router(endpoints_router)
app.include_router(prompts_router)
app.include_router(chat_sessions_router)


def _serve_frontend_path(full_path: str):
    if not frontend_dist.exists():
        return HTMLResponse(
            content=(
                "<html><body><h1>AetherGate-Lite</h1>"
                "<p>Frontend is not built yet. Run the console build first.</p>"
                "</body></html>"
            ),
            status_code=503,
        )

    relative_path = full_path.strip("/")
    if relative_path:
        candidate = (frontend_dist / relative_path).resolve()
        if frontend_dist.resolve() in candidate.parents and candidate.is_file():
            return FileResponse(candidate)

    index_file = frontend_dist / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend index.html not found.")
    return FileResponse(index_file)


@app.get("/", include_in_schema=False)
def serve_frontend_root():
    return _serve_frontend_path("")


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith(("api/", "internal/", "v1/", "docs", "redoc", "openapi.json")):
        raise HTTPException(status_code=404, detail="Not found.")
    return _serve_frontend_path(full_path)
