import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core.config import Settings


def configure_logging(settings: Settings) -> None:
    log_file = Path(settings.log_dir) / "aethergate-lite.log"
    handler = RotatingFileHandler(log_file, maxBytes=2 * 1024 * 1024, backupCount=5)
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(settings.log_level.upper())
    if not any(
        isinstance(existing, RotatingFileHandler)
        and getattr(existing, "baseFilename", None) == str(log_file)
        for existing in root_logger.handlers
    ):
        root_logger.addHandler(handler)

