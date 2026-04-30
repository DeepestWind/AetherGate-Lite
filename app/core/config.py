from __future__ import annotations

import os
import tomllib
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

DEFAULT_APP_NAME = "Branchat"
LEGACY_APP_NAME = "AetherGate-Lite"
DEFAULT_LOG_DIR = "data/logs"
DEFAULT_DATABASE_URL = "sqlite:///./data/branchat.db"
LEGACY_DATABASE_URL = "sqlite:///./data/aethergate-lite.db"
DEFAULT_LOG_FILE_NAME = "branchat.log"
LEGACY_LOG_FILE_NAME = "aethergate-lite.log"


class Settings(BaseModel):
    app_name: str = DEFAULT_APP_NAME
    env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    log_dir: str = DEFAULT_LOG_DIR
    database_url: str = DEFAULT_DATABASE_URL
    auth_token: str = "change-me"
    master_key: str = "dev-master-key-change-me"
    request_timeout_seconds: int = 60
    timezone: str = "Asia/Shanghai"
    failure_threshold: int = 3
    failure_cooldown_seconds: int = 120
    default_strategy: str = "balanced"
    default_temperature: float = 0.2
    default_max_tokens: int = 1024


def _read_config_file() -> dict:
    config_path = Path(os.getenv("BRANCHAT_CONFIG", "config.toml"))
    if not config_path.exists():
        return {}
    with config_path.open("rb") as file_obj:
        raw = tomllib.load(file_obj)
    return raw.get("app", {})


def _read_env_overrides() -> dict:
    mapping = {
        "app_name": "BRANCHAT_APP_NAME",
        "env": "BRANCHAT_ENV",
        "host": "BRANCHAT_HOST",
        "port": "BRANCHAT_PORT",
        "log_level": "BRANCHAT_LOG_LEVEL",
        "log_dir": "BRANCHAT_LOG_DIR",
        "database_url": "BRANCHAT_DATABASE_URL",
        "auth_token": "BRANCHAT_AUTH_TOKEN",
        "master_key": "BRANCHAT_MASTER_KEY",
        "request_timeout_seconds": "BRANCHAT_REQUEST_TIMEOUT_SECONDS",
        "timezone": "BRANCHAT_TIMEZONE",
        "failure_threshold": "BRANCHAT_FAILURE_THRESHOLD",
        "failure_cooldown_seconds": "BRANCHAT_FAILURE_COOLDOWN_SECONDS",
        "default_strategy": "BRANCHAT_DEFAULT_STRATEGY",
        "default_temperature": "BRANCHAT_DEFAULT_TEMPERATURE",
        "default_max_tokens": "BRANCHAT_DEFAULT_MAX_TOKENS",
    }
    data: dict[str, str] = {}
    for field_name, env_name in mapping.items():
        value = os.getenv(env_name)
        if value is not None:
            data[field_name] = value
    return data


def _sqlite_path_from_url(database_url: str) -> Path | None:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return None

    db_path = database_url.removeprefix(prefix)
    if db_path == ":memory:":
        return None
    return Path(db_path)


def _normalize_legacy_defaults(settings: Settings) -> None:
    if settings.app_name == LEGACY_APP_NAME:
        settings.app_name = DEFAULT_APP_NAME
    if settings.database_url == LEGACY_DATABASE_URL:
        settings.database_url = DEFAULT_DATABASE_URL


def _migrate_file(legacy_path: Path, current_path: Path) -> None:
    if not legacy_path.exists() or current_path.exists():
        return

    current_path.parent.mkdir(parents=True, exist_ok=True)
    legacy_path.rename(current_path)


def _prepare_runtime_files(settings: Settings) -> None:
    if settings.database_url == DEFAULT_DATABASE_URL:
        legacy_db_path = _sqlite_path_from_url(LEGACY_DATABASE_URL)
        current_db_path = _sqlite_path_from_url(DEFAULT_DATABASE_URL)
        if legacy_db_path and current_db_path:
            _migrate_file(legacy_db_path, current_db_path)

    if settings.log_dir == DEFAULT_LOG_DIR:
        legacy_log_path = Path(settings.log_dir) / LEGACY_LOG_FILE_NAME
        current_log_path = Path(settings.log_dir) / DEFAULT_LOG_FILE_NAME
        _migrate_file(legacy_log_path, current_log_path)

    Path(settings.log_dir).mkdir(parents=True, exist_ok=True)
    db_path = _sqlite_path_from_url(settings.database_url)
    if db_path:
        db_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    data = _read_config_file()
    data.update(_read_env_overrides())
    settings = Settings.model_validate(data)
    _normalize_legacy_defaults(settings)
    _prepare_runtime_files(settings)
    return settings
