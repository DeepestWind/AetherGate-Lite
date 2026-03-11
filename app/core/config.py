from __future__ import annotations

import os
import tomllib
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_name: str = "AetherGate-Lite"
    env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    log_dir: str = "data/logs"
    database_url: str = "sqlite:///./data/aethergate-lite.db"
    auth_token: str = "change-me"
    master_key: str = "dev-master-key-change-me"
    cache_ttl_seconds: int = 300
    cache_temperature_threshold: float = 0.3
    request_timeout_seconds: int = 60
    timezone: str = "Asia/Shanghai"
    failure_threshold: int = 3
    failure_cooldown_seconds: int = 120
    default_strategy: str = "balanced"
    default_temperature: float = 0.2
    default_max_tokens: int = 1024


def _read_config_file() -> dict:
    config_path = Path(os.getenv("AETHERGATE_CONFIG", "config.toml"))
    if not config_path.exists():
        return {}
    with config_path.open("rb") as file_obj:
        raw = tomllib.load(file_obj)
    return raw.get("app", {})


def _read_env_overrides() -> dict:
    mapping = {
        "app_name": "AETHERGATE_APP_NAME",
        "env": "AETHERGATE_ENV",
        "host": "AETHERGATE_HOST",
        "port": "AETHERGATE_PORT",
        "log_level": "AETHERGATE_LOG_LEVEL",
        "log_dir": "AETHERGATE_LOG_DIR",
        "database_url": "AETHERGATE_DATABASE_URL",
        "auth_token": "AETHERGATE_AUTH_TOKEN",
        "master_key": "AETHERGATE_MASTER_KEY",
        "cache_ttl_seconds": "AETHERGATE_CACHE_TTL_SECONDS",
        "cache_temperature_threshold": "AETHERGATE_CACHE_TEMPERATURE_THRESHOLD",
        "request_timeout_seconds": "AETHERGATE_REQUEST_TIMEOUT_SECONDS",
        "timezone": "AETHERGATE_TIMEZONE",
        "failure_threshold": "AETHERGATE_FAILURE_THRESHOLD",
        "failure_cooldown_seconds": "AETHERGATE_FAILURE_COOLDOWN_SECONDS",
        "default_strategy": "AETHERGATE_DEFAULT_STRATEGY",
        "default_temperature": "AETHERGATE_DEFAULT_TEMPERATURE",
        "default_max_tokens": "AETHERGATE_DEFAULT_MAX_TOKENS",
    }
    data: dict[str, str] = {}
    for field_name, env_name in mapping.items():
        value = os.getenv(env_name)
        if value is not None:
            data[field_name] = value
    return data


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    data = _read_config_file()
    data.update(_read_env_overrides())
    settings = Settings.model_validate(data)
    Path(settings.log_dir).mkdir(parents=True, exist_ok=True)
    db_path = settings.database_url.replace("sqlite:///", "", 1)
    if db_path and db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return settings

