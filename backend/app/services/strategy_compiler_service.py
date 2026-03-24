"""Natural-language strategy compiler service."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.core.strategies.spec import StrategySpec
from app.services.indicator_registry import get_all_indicators
from app.services.langfuse_client import get_langfuse_client
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

        lf = get_langfuse_client()
        trace = (
            lf.trace(
                name="strategy_compile",
                input={"prompt": prompt, "name": name, "description": description},
                metadata={"model": self.settings.OPENAI_MODEL},
            )
            if lf
            else None
        )

        guard_span = trace.span(name="prompt_guard") if trace else None
        guard_result = self.prompt_guard.evaluate(prompt, name=name, description=description)
        if guard_span:
            guard_span.end(
                output={
                    "decision": guard_result.decision,
                    "reasons": guard_result.reasons,
                    "warnings": guard_result.warnings,
                }
            )

        if guard_result.decision == "reject":
            if trace:
                trace.update(
                    level="WARNING",
                    status_message="; ".join(guard_result.reasons),
                )
            raise ValueError("; ".join(guard_result.reasons))

        try:
            payload = await self._request_llm(
                guard_result.normalized_prompt, name=name, description=description, trace=trace
            )
            spec = StrategySpec.model_validate(payload)

            result = {
                "normalized_spec": spec,
                "summary": self._summarize_spec(spec),
                "warnings": self._build_warnings(guard_result.normalized_prompt, spec),
                "prompt_warnings": guard_result.warnings,
            }

            if trace:
                trace.update(output={"summary": result["summary"], "warnings": result["warnings"]})

            return result

        except Exception as exc:
            if trace:
                trace.update(level="ERROR", status_message=str(exc))
            raise

    async def _request_llm(
        self, prompt: str, name: str | None = None, description: str | None = None, trace=None
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

        generation = (
            trace.generation(
                name="openai_chat_completion",
                model=self.settings.OPENAI_MODEL,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload)},
                ],
            )
            if trace
            else None
        )

        try:
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

            if generation:
                usage = data.get("usage", {})
                generation.end(
                    output=content,
                    usage={
                        "promptTokens": usage.get("prompt_tokens"),
                        "completionTokens": usage.get("completion_tokens"),
                        "totalTokens": usage.get("total_tokens"),
                    },
                )

            return json.loads(content)

        except Exception as exc:
            if generation:
                generation.end(level="ERROR", status_message=str(exc))
            raise

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
