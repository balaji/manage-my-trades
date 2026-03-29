"""Natural-language strategy compiler service."""

from __future__ import annotations

import json
import logging
from typing import Any

from langfuse.openai import AsyncOpenAI

from app.config import get_settings
from app.core.strategies.spec import StrategySpec
from app.services.indicator_registry import get_all_indicators
from app.services.strategy_prompt_guard_service import StrategyPromptGuardService

logger = logging.getLogger(__name__)


class StrategyCompilerService:
    """Compile natural language requests into validated strategy specs."""

    def __init__(self):
        self.settings = get_settings()
        self.prompt_guard = StrategyPromptGuardService()

    async def compile(self, prompt: str, name: str | None = None, description: str | None = None) -> dict[str, Any]:
        """Compile a prompt to a normalized strategy spec."""
        if not self.settings.OPENAI_API_KEY:
            raise ValueError("OpenAI compiler is not configured. Set OPENAI_API_KEY to enable strategy compilation.")

        guard_result = self.prompt_guard.evaluate(prompt, name=name, description=description)
        if guard_result.decision == "reject":
            raise ValueError("; ".join(guard_result.reasons))

        payload = await self._request_llm(guard_result.normalized_prompt, name=name, description=description)
        spec = StrategySpec.model_validate(payload)

        return {
            "normalized_spec": spec,
            "summary": self._summarize_spec(spec),
            "warnings": self._build_warnings(guard_result.normalized_prompt, spec),
            "prompt_warnings": guard_result.warnings,
        }

    async def _request_llm(
        self, prompt: str, name: str | None = None, description: str | None = None
    ) -> dict[str, Any]:
        """Send a structured completion request to OpenAI."""
        schema = StrategySpec.model_json_schema()
        indicators = get_all_indicators()
        indicator_names = ", ".join(indicator["name"] for indicator in indicators)
        multi_output_examples = ", ".join(
            f"{indicator['name']}({', '.join(indicator['output_names'])})"
            for indicator in indicators
            if len(indicator["output_names"]) > 1
        )
        system_prompt = (
            "You convert user requests into a strict technical trading strategy specification. "
            "Only produce strategies using supported indicators and long-only technical rules. "
            f"Supported indicators: {indicator_names}. "
            f"Use TA-Lib function names and parameter names exactly. Multi-output indicator fields include: {multi_output_examples}. "
            "Use the schema exactly, including compare/cross rules and indicator fields where required. "
            "Do not create ML, options, shorts, or unsupported indicators. "
            "If the request is ambiguous, choose conservative defaults and encode them explicitly."
        )
        user_payload = {
            "prompt": prompt,
            "name": name,
            "description": description,
        }
        async with AsyncOpenAI(
            api_key=self.settings.OPENAI_API_KEY,
            base_url=self.settings.OPENAI_BASE_URL.rstrip("/"),
            timeout=60.0,
        ) as client:
            response = await client.chat.completions.create(
                model=self.settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload)},
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": "strategy_spec", "schema": schema},
                },
            )

        content = response.choices[0].message.content
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        if not isinstance(content, str):
            raise ValueError("Compiler returned an unexpected payload")

        return json.loads(content)

    @staticmethod
    def _summarize_spec(spec: StrategySpec) -> str:
        """Generate a short human-readable summary."""
        indicator_labels = ", ".join(f"{item.alias}:{item.indicator}" for item in spec.indicators)
        return f"{spec.metadata.name}: technical strategy using {indicator_labels}. Timeframe {spec.market.timeframe}."

    @staticmethod
    def _build_warnings(prompt: str, spec: StrategySpec) -> list[str]:
        """Generate lightweight warnings for operator review."""
        warnings = []
        lowered = prompt.lower()
        if "paper" in lowered or "live" in lowered:
            warnings.append(
                "Compiled for backtesting semantics only; paper/live execution is not enabled by this flow."
            )
        if spec.risk.position_sizing.method == "fixed_percentage" and spec.risk.position_sizing.percentage == 0.1:
            warnings.append("Used default 10% position sizing because the request did not specify sizing.")
        return warnings
