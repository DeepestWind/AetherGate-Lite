import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_tmp_dir = Path(tempfile.mkdtemp(prefix="aethergate-lite-tests-"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("AETHERGATE_DATABASE_URL", f"sqlite:///{_tmp_dir / 'test.db'}")
os.environ.setdefault("AETHERGATE_AUTH_TOKEN", "test-token")
os.environ.setdefault("AETHERGATE_MASTER_KEY", "test-master-key")
os.environ.setdefault("AETHERGATE_LOG_DIR", str(_tmp_dir / "logs"))

from app.core.config import get_settings

get_settings.cache_clear()

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models.chat_session import ChatConversation, ChatMessageRecord
from app.models.endpoint import ModelEndpoint
from app.models.prompt import PromptTemplate
from app.models.request_log import RequestLog
from app.services.gateway import gateway_service

Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_state():
    with SessionLocal() as db:
        db.query(ChatMessageRecord).delete()
        db.query(ChatConversation).delete()
        db.query(RequestLog).delete()
        db.query(PromptTemplate).delete()
        db.query(ModelEndpoint).delete()
        db.commit()
    gateway_service.cache._store.clear()
    gateway_service.state_tracker._state.clear()
    gateway_service.routing._balanced_cursor.clear()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers():
    return {"Authorization": "Bearer test-token"}
