"""Unit tests for the strategy compiler service guard integration."""

import asyncio
from types import SimpleNamespace

import pytest

import app.services.strategy_compiler_service as compiler_module
from app.services.strategy_prompt_guard_service import PromptGuardResult


def _llm_payload() -> dict:
    return {
        "kind": "technical",
        "metadata": {"name": "Guard Test"},
        "market": {"timeframe": "1d"},
        "indicators": [
            {"alias": "fast_ma", "indicator": "EMA", "params": {"timeperiod": 20}},
            {"alias": "slow_ma", "indicator": "SMA", "params": {"timeperiod": 50}},
        ],
        "rules": {
            "entry": {
                "type": "cross",
                "left": {"type": "indicator", "alias": "fast_ma"},
                "operator": "crosses_above",
                "right": {"type": "indicator", "alias": "slow_ma"},
            },
            "exit": {
                "type": "cross",
                "left": {"type": "indicator", "alias": "fast_ma"},
                "operator": "crosses_below",
                "right": {"type": "indicator", "alias": "slow_ma"},
            },
            "filters": [],
        },
        "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
        "execution": {},
    }


def _service(monkeypatch) -> compiler_module.StrategyCompilerService:
    monkeypatch.setattr(
        compiler_module,
        "get_settings",
        lambda: SimpleNamespace(
            OPENAI_API_KEY="test-key",
            OPENAI_MODEL="gpt-4.1-mini",
            OPENAI_BASE_URL="https://api.openai.com/v1",
        ),
    )
    return compiler_module.StrategyCompilerService()


def test_compile_does_not_call_llm_when_guard_rejects(monkeypatch):
    service = _service(monkeypatch)

    def fake_evaluate(prompt: str, name: str | None = None, description: str | None = None) -> PromptGuardResult:
        return PromptGuardResult(
            decision="reject",
            normalized_prompt="",
            reasons=["Prompt is too short."],
            warnings=[],
            metrics={},
        )

    async def fake_request_llm(
        prompt: str, name: str | None = None, description: str | None = None, langfuse_client=None
    ) -> dict:
        raise AssertionError("LLM should not be called for rejected prompts")

    monkeypatch.setattr(service.prompt_guard, "evaluate", fake_evaluate)
    monkeypatch.setattr(service, "_request_llm", fake_request_llm)

    with pytest.raises(ValueError, match="too short"):
        asyncio.run(service.compile("bad"))


def test_compile_uses_normalized_prompt_and_returns_prompt_warnings(monkeypatch):
    service = _service(monkeypatch)
    captured: dict[str, str] = {}

    def fake_evaluate(prompt: str, name: str | None = None, description: str | None = None) -> PromptGuardResult:
        return PromptGuardResult(
            decision="accept_with_warnings",
            normalized_prompt="Buy SPY when EMA 20 crosses above SMA 50. Sell when it crosses below.",
            reasons=[],
            warnings=["Removed URL-only lines before compilation."],
            metrics={},
        )

    async def fake_request_llm(
        prompt: str, name: str | None = None, description: str | None = None, langfuse_client=None
    ) -> dict:
        captured["prompt"] = prompt
        return _llm_payload()

    monkeypatch.setattr(service.prompt_guard, "evaluate", fake_evaluate)
    monkeypatch.setattr(service, "_request_llm", fake_request_llm)

    result = asyncio.run(service.compile("raw prompt with url"))

    assert captured["prompt"] == "Buy SPY when EMA 20 crosses above SMA 50. Sell when it crosses below."
    assert result["prompt_warnings"] == ["Removed URL-only lines before compilation."]
    assert any("default 10% position sizing" in warning for warning in result["warnings"])


def test_compile_works_without_langfuse_keys(monkeypatch):
    service = _service(monkeypatch)
    monkeypatch.setattr(compiler_module, "get_langfuse_client", lambda: None)

    langfuse_received = {}

    async def fake_request_llm(
        prompt: str, name: str | None = None, description: str | None = None, langfuse_client=None
    ) -> dict:
        langfuse_received["client"] = langfuse_client
        return _llm_payload()

    monkeypatch.setattr(service, "_request_llm", fake_request_llm)
    monkeypatch.setattr(
        service.prompt_guard,
        "evaluate",
        lambda p, **kw: PromptGuardResult(decision="accept", normalized_prompt=p, reasons=[], warnings=[], metrics={}),
    )

    result = asyncio.run(service.compile("Buy SPY when EMA crosses above SMA."))
    assert langfuse_received["client"] is None
    assert result["normalized_spec"] is not None


def test_compile_creates_langfuse_spans_when_configured(monkeypatch):
    from unittest.mock import MagicMock

    service = _service(monkeypatch)

    mock_compiler_span = MagicMock()
    mock_guard_span = MagicMock()
    mock_compiler_context = MagicMock()
    mock_compiler_context.__enter__.return_value = mock_compiler_span
    mock_compiler_context.__exit__.return_value = None
    mock_guard_context = MagicMock()
    mock_guard_context.__enter__.return_value = mock_guard_span
    mock_guard_context.__exit__.return_value = None
    mock_lf = MagicMock()
    mock_lf.start_as_current_observation.side_effect = [mock_compiler_context, mock_guard_context]

    monkeypatch.setattr(compiler_module, "get_langfuse_client", lambda: mock_lf)

    async def fake_request_llm(
        prompt: str, name: str | None = None, description: str | None = None, langfuse_client=None
    ) -> dict:
        assert langfuse_client is mock_lf
        return _llm_payload()

    monkeypatch.setattr(service, "_request_llm", fake_request_llm)
    monkeypatch.setattr(
        service.prompt_guard,
        "evaluate",
        lambda p, **kw: PromptGuardResult(decision="accept", normalized_prompt=p, reasons=[], warnings=[], metrics={}),
    )

    asyncio.run(service.compile("Buy SPY when EMA crosses above SMA."))

    assert mock_lf.start_as_current_observation.call_count == 2
    first_call = mock_lf.start_as_current_observation.call_args_list[0]
    second_call = mock_lf.start_as_current_observation.call_args_list[1]
    assert first_call.kwargs["name"] == "strategy_compile"
    assert first_call.kwargs["as_type"] == "span"
    assert second_call.kwargs["name"] == "prompt_guard"
    assert second_call.kwargs["as_type"] == "guardrail"
    mock_guard_span.update.assert_called_once()
    mock_compiler_span.update.assert_called()


def test_compile_updates_root_span_with_warning_on_guard_reject(monkeypatch):
    from unittest.mock import MagicMock

    service = _service(monkeypatch)

    mock_compiler_span = MagicMock()
    mock_guard_span = MagicMock()
    mock_compiler_context = MagicMock()
    mock_compiler_context.__enter__.return_value = mock_compiler_span
    mock_compiler_context.__exit__.return_value = None
    mock_guard_context = MagicMock()
    mock_guard_context.__enter__.return_value = mock_guard_span
    mock_guard_context.__exit__.return_value = None
    mock_lf = MagicMock()
    mock_lf.start_as_current_observation.side_effect = [mock_compiler_context, mock_guard_context]

    monkeypatch.setattr(compiler_module, "get_langfuse_client", lambda: mock_lf)
    monkeypatch.setattr(
        service.prompt_guard,
        "evaluate",
        lambda p, **kw: PromptGuardResult(
            decision="reject", normalized_prompt="", reasons=["Too short."], warnings=[], metrics={}
        ),
    )

    with pytest.raises(ValueError):
        asyncio.run(service.compile("bad"))

    mock_compiler_span.update.assert_called_once()
    update_kwargs = mock_compiler_span.update.call_args.kwargs
    assert update_kwargs["level"] == "WARNING"


def test_request_llm_creates_generation_when_langfuse_configured(monkeypatch):
    from unittest.mock import MagicMock

    service = _service(monkeypatch)

    mock_generation = MagicMock()
    mock_generation_context = MagicMock()
    mock_generation_context.__enter__.return_value = mock_generation
    mock_generation_context.__exit__.return_value = None
    mock_lf = MagicMock()
    mock_lf.start_as_current_observation.return_value = mock_generation_context

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"kind":"technical","metadata":{"name":"Guard Test"},"market":{"timeframe":"1d"},"indicators":[],"rules":{"entry":{"type":"cross","left":{"type":"indicator","alias":"fast_ma"},"operator":"crosses_above","right":{"type":"indicator","alias":"slow_ma"}},"exit":{"type":"cross","left":{"type":"indicator","alias":"fast_ma"},"operator":"crosses_below","right":{"type":"indicator","alias":"slow_ma"}},"filters":[]},"risk":{"position_sizing":{"method":"fixed_percentage","percentage":0.1}},"execution":{}}'
                        }
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            }

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(compiler_module.httpx, "AsyncClient", FakeAsyncClient)

    result = asyncio.run(service._request_llm("Buy SPY", langfuse_client=mock_lf))

    assert result["kind"] == "technical"
    mock_lf.start_as_current_observation.assert_called_once()
    assert mock_lf.start_as_current_observation.call_args.kwargs["name"] == "openai_chat_completion"
    assert mock_lf.start_as_current_observation.call_args.kwargs["as_type"] == "generation"
    mock_generation.update.assert_called_once()
