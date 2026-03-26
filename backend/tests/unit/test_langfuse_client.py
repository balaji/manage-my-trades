"""Unit tests for the Langfuse client singleton helper."""

from types import SimpleNamespace

import app.services.langfuse_client as lf_module


def _reset(monkeypatch):
    monkeypatch.setattr(lf_module, "_initialised", False)
    monkeypatch.setattr(lf_module, "_langfuse_instance", None)


def test_get_langfuse_client_returns_none_without_keys(monkeypatch):
    _reset(monkeypatch)
    monkeypatch.setattr(
        lf_module,
        "get_langfuse_client",
        lambda: None,
    )
    # Re-test without the shortcut: reset and patch config
    _reset(monkeypatch)
    import app.config as config_module

    monkeypatch.setattr(
        config_module,
        "get_settings",
        lambda: SimpleNamespace(
            LANGFUSE_PUBLIC_KEY="",
            LANGFUSE_SECRET_KEY="",
            LANGFUSE_BASE_URL="https://cloud.langfuse.com",
        ),
    )
    result = lf_module.get_langfuse_client()
    assert result is None


def test_get_langfuse_client_returns_none_on_missing_secret(monkeypatch):
    _reset(monkeypatch)
    import app.config as config_module

    monkeypatch.setattr(
        config_module,
        "get_settings",
        lambda: SimpleNamespace(
            LANGFUSE_PUBLIC_KEY="pk-test",
            LANGFUSE_SECRET_KEY="",
            LANGFUSE_BASE_URL="https://cloud.langfuse.com",
        ),
    )
    result = lf_module.get_langfuse_client()
    assert result is None


def test_get_langfuse_client_is_idempotent(monkeypatch):
    """Calling get_langfuse_client() twice returns the same instance."""
    _reset(monkeypatch)
    import app.config as config_module

    monkeypatch.setattr(
        config_module,
        "get_settings",
        lambda: SimpleNamespace(
            LANGFUSE_PUBLIC_KEY="",
            LANGFUSE_SECRET_KEY="",
            LANGFUSE_BASE_URL="https://cloud.langfuse.com",
        ),
    )
    r1 = lf_module.get_langfuse_client()
    r2 = lf_module.get_langfuse_client()
    assert r1 is r2
