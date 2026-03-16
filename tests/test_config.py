from pathlib import Path

from app.core.config import (
    DEFAULT_APP_NAME,
    DEFAULT_DATABASE_URL,
    DEFAULT_LOG_DIR,
    DEFAULT_LOG_FILE_NAME,
    LEGACY_DATABASE_URL,
    LEGACY_LOG_FILE_NAME,
    get_settings,
)


def _clear_branchat_env(monkeypatch):
    for key in (
        "BRANCHAT_CONFIG",
        "BRANCHAT_APP_NAME",
        "BRANCHAT_ENV",
        "BRANCHAT_HOST",
        "BRANCHAT_PORT",
        "BRANCHAT_LOG_LEVEL",
        "BRANCHAT_LOG_DIR",
        "BRANCHAT_DATABASE_URL",
        "BRANCHAT_AUTH_TOKEN",
        "BRANCHAT_MASTER_KEY",
        "BRANCHAT_CACHE_TTL_SECONDS",
        "BRANCHAT_CACHE_TEMPERATURE_THRESHOLD",
        "BRANCHAT_REQUEST_TIMEOUT_SECONDS",
        "BRANCHAT_TIMEZONE",
        "BRANCHAT_FAILURE_THRESHOLD",
        "BRANCHAT_FAILURE_COOLDOWN_SECONDS",
        "BRANCHAT_DEFAULT_STRATEGY",
        "BRANCHAT_DEFAULT_TEMPERATURE",
        "BRANCHAT_DEFAULT_MAX_TOKENS",
    ):
        monkeypatch.delenv(key, raising=False)


def test_settings_read_branchat_env_prefix(monkeypatch, tmp_path):
    _clear_branchat_env(monkeypatch)
    monkeypatch.setenv("BRANCHAT_APP_NAME", "Branchat Test")
    monkeypatch.setenv("BRANCHAT_DATABASE_URL", f"sqlite:///{tmp_path / 'custom.db'}")
    monkeypatch.setenv("BRANCHAT_LOG_DIR", str(tmp_path / "custom-logs"))

    get_settings.cache_clear()
    settings = get_settings()
    assert settings.app_name == "Branchat Test"
    assert settings.database_url == f"sqlite:///{tmp_path / 'custom.db'}"
    assert settings.log_dir == str(tmp_path / "custom-logs")
    get_settings.cache_clear()


def test_settings_migrate_legacy_default_runtime_files(monkeypatch, tmp_path):
    _clear_branchat_env(monkeypatch)
    monkeypatch.chdir(tmp_path)

    legacy_db = tmp_path / "data" / Path(LEGACY_DATABASE_URL.removeprefix("sqlite:///")).name
    legacy_db.parent.mkdir(parents=True, exist_ok=True)
    legacy_db.write_text("legacy-db", encoding="utf-8")

    legacy_log = tmp_path / DEFAULT_LOG_DIR / LEGACY_LOG_FILE_NAME
    legacy_log.parent.mkdir(parents=True, exist_ok=True)
    legacy_log.write_text("legacy-log", encoding="utf-8")

    get_settings.cache_clear()
    settings = get_settings()
    current_db = tmp_path / "data" / Path(DEFAULT_DATABASE_URL.removeprefix("sqlite:///")).name
    current_log = tmp_path / DEFAULT_LOG_DIR / DEFAULT_LOG_FILE_NAME

    assert settings.app_name == DEFAULT_APP_NAME
    assert settings.database_url == DEFAULT_DATABASE_URL
    assert current_db.exists()
    assert current_db.read_text(encoding="utf-8") == "legacy-db"
    assert not legacy_db.exists()
    assert current_log.exists()
    assert current_log.read_text(encoding="utf-8") == "legacy-log"
    assert not legacy_log.exists()
    get_settings.cache_clear()


def test_settings_do_not_overwrite_new_runtime_files(monkeypatch, tmp_path):
    _clear_branchat_env(monkeypatch)
    monkeypatch.chdir(tmp_path)

    legacy_db = tmp_path / "data" / Path(LEGACY_DATABASE_URL.removeprefix("sqlite:///")).name
    legacy_db.parent.mkdir(parents=True, exist_ok=True)
    legacy_db.write_text("legacy-db", encoding="utf-8")

    current_db = tmp_path / "data" / Path(DEFAULT_DATABASE_URL.removeprefix("sqlite:///")).name
    current_db.write_text("current-db", encoding="utf-8")

    legacy_log = tmp_path / DEFAULT_LOG_DIR / LEGACY_LOG_FILE_NAME
    legacy_log.parent.mkdir(parents=True, exist_ok=True)
    legacy_log.write_text("legacy-log", encoding="utf-8")

    current_log = tmp_path / DEFAULT_LOG_DIR / DEFAULT_LOG_FILE_NAME
    current_log.write_text("current-log", encoding="utf-8")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.database_url == DEFAULT_DATABASE_URL
    assert current_db.read_text(encoding="utf-8") == "current-db"
    assert legacy_db.read_text(encoding="utf-8") == "legacy-db"
    assert current_log.read_text(encoding="utf-8") == "current-log"
    assert legacy_log.read_text(encoding="utf-8") == "legacy-log"
    get_settings.cache_clear()
