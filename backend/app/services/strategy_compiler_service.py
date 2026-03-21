"""Natural-language strategy compiler service."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.core.strategies.spec import StrategySpec, SUPPORTED_INDICATORS

logger = logging.getLogger(__name__)


class StrategyCompilerService:
    """Compile natural language requests into validated strategy specs."""

    def __init__(self):
        self.settings = get_settings()

    async def compile(self, prompt: str, name: str | None = None, description: str | None = None) -> dict[str, Any]:
        """Compile a prompt to a normalized strategy spec."""
        if not self.settings.OPENAI_API_KEY:
            raise ValueError("OpenAI compiler is not configured. Set OPENAI_API_KEY to enable strategy compilation.")

        payload = await self._request_llm(prompt, name=name, description=description)
        spec = StrategySpec.model_validate(payload)

        return {
            "normalized_spec": spec,
            "summary": self._summarize_spec(spec),
            "warnings": self._build_warnings(prompt, spec),
        }

    async def _request_llm(
        self, prompt: str, name: str | None = None, description: str | None = None
    ) -> dict[str, Any]:
        """Send a structured completion request to OpenAI."""
        schema = StrategySpec.model_json_schema()
        indicator_names = ", ".join(sorted(SUPPORTED_INDICATORS.keys()))
        system_prompt = (
            "You convert user requests into a strict technical trading strategy specification. "
            "Only produce strategies using supported indicators and simple long-only rules. "
            f"Supported indicators: {indicator_names}. "
            "Do not create ML, options, shorts, or unsupported indicators. "
            "If the request is ambiguous, choose conservative defaults and encode them explicitly."
        )
        user_payload = {
            "prompt": prompt,
            "name": name,
            "description": description,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(user_payload)},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {"name": "strategy_spec", "schema": schema},
                    },
                },
            )
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        if not isinstance(content, str):
            raise ValueError("Compiler returned an unexpected payload")

        return json.loads(content)

    @staticmethod
    def _summarize_spec(spec: StrategySpec) -> str:
        """Generate a short human-readable summary."""
        indicator_labels = ", ".join(f"{item.alias}:{item.indicator}" for item in spec.indicators)
        symbols = ", ".join(spec.market.symbols) if spec.market.symbols else "no default symbols"
        return (
            f"{spec.metadata.name}: technical strategy on {symbols} using {indicator_labels}. "
            f"Timeframe {spec.market.timeframe}."
        )

    @staticmethod
    def _build_warnings(prompt: str, spec: StrategySpec) -> list[str]:
        """Generate lightweight warnings for operator review."""
        warnings = []
        lowered = prompt.lower()
        if "paper" in lowered or "live" in lowered:
            warnings.append(
                "Compiled for backtesting semantics only; paper/live execution is not enabled by this flow."
            )
        if not spec.market.symbols:
            warnings.append("No default symbols were inferred; choose symbols when creating the backtest.")
        if spec.risk.position_sizing.method == "fixed_percentage" and spec.risk.position_sizing.percentage == 0.1:
            warnings.append("Used default 10% position sizing because the request did not specify sizing.")
        return warnings
