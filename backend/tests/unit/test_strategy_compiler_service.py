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
            {"alias": "fast_ma", "indicator": "ema", "params": {"length": 20}},
            {"alias": "slow_ma", "indicator": "sma", "params": {"length": 50}},
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

    async def fake_request_llm(prompt: str, name: str | None = None, description: str | None = None) -> dict:
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

    async def fake_request_llm(prompt: str, name: str | None = None, description: str | None = None) -> dict:
        captured["prompt"] = prompt
        return _llm_payload()

    monkeypatch.setattr(service.prompt_guard, "evaluate", fake_evaluate)
    monkeypatch.setattr(service, "_request_llm", fake_request_llm)

    result = asyncio.run(service.compile("raw prompt with url"))

    assert captured["prompt"] == "Buy SPY when EMA 20 crosses above SMA 50. Sell when it crosses below."
    assert result["prompt_warnings"] == ["Removed URL-only lines before compilation."]
    assert any("default 10% position sizing" in warning for warning in result["warnings"])
