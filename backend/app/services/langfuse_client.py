"""Lazily initialised Langfuse client singleton. Returns None when not configured."""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

_langfuse_instance: Optional[object] = None
_initialised = False


def get_langfuse_client():
    """Return a shared Langfuse client, or None if keys are not configured."""
    global _langfuse_instance, _initialised
    if _initialised:
        return _langfuse_instance

    _initialised = True
    from app.config import get_settings

    settings = get_settings()

    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        logger.info("Langfuse observability disabled (LANGFUSE_PUBLIC_KEY/SECRET_KEY not set)")
        return None

    try:
        from langfuse import Langfuse

        _langfuse_instance = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_BASE_URL,
        )
        logger.info("Langfuse observability enabled (host=%s)", settings.LANGFUSE_BASE_URL)
    except Exception:
        logger.exception("Failed to initialise Langfuse client; observability disabled")
        _langfuse_instance = None

    return _langfuse_instance


def flush_langfuse() -> None:
    """Flush pending events — call this from the FastAPI shutdown hook."""
    if _langfuse_instance is not None:
        _langfuse_instance.flush()
