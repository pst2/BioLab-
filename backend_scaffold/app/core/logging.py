from __future__ import annotations

import logging
import os


def configure_logging() -> None:
    """Configure root logger.

    Log level is controlled by the LOG_LEVEL environment variable
    (default: INFO). In DEBUG mode the app also sets SQLAlchemy echo
    via the engine config — this function does not touch that.
    """
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Silence noisy third-party loggers unless we are at DEBUG level.
    if level > logging.DEBUG:
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
