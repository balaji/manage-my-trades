"""Helpers for adapting legacy strategy records to canonical specs."""

from __future__ import annotations

from typing import Any

from app.core.strategies.spec import (
    StrategySpec,
)


def build_legacy_spec(
    *,
    config: StrategySpec | dict[str, Any] | None,
) -> StrategySpec:
    """Build a canonical strategy spec from the current legacy DB shape."""
    if isinstance(config, StrategySpec):
        return config

    config = config or {}

    if config.get("kind") == "technical" and "metadata" in config and "indicators" in config and "rules" in config:
        return StrategySpec.model_validate(config)

    raise ValueError("Legacy strategies must contain at least one indicator to build a spec")
