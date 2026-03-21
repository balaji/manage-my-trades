"""Helpers for adapting legacy strategy records to canonical specs."""

from __future__ import annotations

from typing import Any

from app.core.strategies.spec import StrategySpec, normalize_indicator_name


def comparison_indicator_constant(alias: str, operator: str, value: float, field: str | None = None) -> dict[str, Any]:
    """Build a comparison rule against a constant."""
    return {
        "type": "comparison",
        "left": {"source": "indicator", "value": alias, "field": field},
        "operator": operator,
        "right": {"source": "constant", "value": value},
    }


def comparison_indicators(left_alias: str, operator: str, right_alias: str) -> dict[str, Any]:
    """Build a comparison rule between indicators."""
    return {
        "type": "comparison",
        "left": {"source": "indicator", "value": left_alias},
        "operator": operator,
        "right": {"source": "indicator", "value": right_alias},
    }


def build_legacy_spec(
    *,
    name: str,
    description: str | None,
    config: StrategySpec | dict[str, Any] | None,
    indicators: list[dict[str, Any]],
) -> StrategySpec:
    """Build a canonical strategy spec from the current legacy DB shape."""
    if isinstance(config, StrategySpec):
        return config

    config = config or {}
    indicators = indicators or []

    if config.get("kind") == "technical" and "metadata" in config and "indicators" in config and "rules" in config:
        return StrategySpec.model_validate(config)

    spec_indicators = []
    for index, indicator in enumerate(indicators, start=1):
        indicator_name = normalize_indicator_name(indicator["indicator_name"])
        spec_indicators.append(
            {
                "alias": indicator.get("alias") or f"{indicator_name}_{index}",
                "indicator": indicator_name,
                "params": indicator.get("parameters", {}),
            }
        )

    if not spec_indicators:
        raise ValueError("Legacy strategies must contain at least one indicator to build a spec")

    by_name = {indicator["indicator"]: indicator["alias"] for indicator in spec_indicators}

    if "rsi" in by_name:
        entry_rule = comparison_indicator_constant(by_name["rsi"], "<", float(config.get("entry_threshold", 30)))
        exit_rule = comparison_indicator_constant(by_name["rsi"], ">", float(config.get("exit_threshold", 70)))
    elif "ema" in by_name and "sma" in by_name:
        entry_rule = comparison_indicators(by_name["ema"], ">", by_name["sma"])
        exit_rule = comparison_indicators(by_name["ema"], "<", by_name["sma"])
    elif "macd" in by_name:
        entry_rule = comparison_indicator_constant(by_name["macd"], ">", 0.0, field="histogram")
        exit_rule = comparison_indicator_constant(by_name["macd"], "<", 0.0, field="histogram")
    else:
        alias = spec_indicators[0]["alias"]
        entry_rule = comparison_indicator_constant(alias, ">", 0.0)
        exit_rule = comparison_indicator_constant(alias, "<", 0.0)

    position_sizing = config.get("position_sizing") or {}
    if "position_size" in config and "percentage" not in position_sizing:
        position_sizing = {"method": "fixed_percentage", "percentage": float(config["position_size"])}

    payload = {
        "kind": "technical",
        "metadata": {"name": name, "description": description},
        "market": {"timeframe": config.get("timeframe", "1d"), "symbols": config.get("symbols", [])},
        "indicators": spec_indicators,
        "rules": {"entry": entry_rule, "exit": exit_rule, "filters": []},
        "risk": {"position_sizing": position_sizing or {"method": "fixed_percentage", "percentage": 0.1}},
        "execution": {},
    }
    return StrategySpec.model_validate(payload)


def indicator_rows_from_spec(spec: StrategySpec) -> list[dict[str, Any]]:
    """Derive legacy indicator rows from a canonical spec."""

    exit_aliases = extract_rule_aliases(spec.rules.exit)
    filter_aliases = set()
    for filter_rule in spec.rules.filters:
        filter_aliases.update(extract_rule_aliases(filter_rule))

    rows = []
    for indicator in spec.indicators:
        if indicator.alias in filter_aliases:
            usage = "filter"
        elif indicator.alias in exit_aliases:
            usage = "exit"
        else:
            usage = "entry"

        rows.append(
            {
                "indicator_name": indicator.indicator,
                "parameters": indicator.params,
                "usage": usage,
            }
        )

    return rows


def extract_rule_aliases(rule: Any) -> set[str]:
    """Collect indicator aliases used by a rule node."""
    if isinstance(rule, dict):
        rule_type = rule.get("type")
        if rule_type == "comparison":
            aliases = set()
            for ref in (rule.get("left"), rule.get("right")):
                if ref and ref.get("source") == "indicator":
                    aliases.add(ref["value"])
            return aliases
        if rule_type in {"all", "any"}:
            aliases = set()
            for child in rule.get("conditions", []):
                aliases.update(extract_rule_aliases(child))
            return aliases
        if rule_type == "not":
            return extract_rule_aliases(rule.get("condition"))

    rule_type = getattr(rule, "type", None)
    if rule_type == "comparison":
        aliases = set()
        for ref in (rule.left, rule.right):
            if ref.source == "indicator":
                aliases.add(str(ref.value))
        return aliases
    if rule_type in {"all", "any"}:
        aliases = set()
        for child in rule.conditions:
            aliases.update(extract_rule_aliases(child))
        return aliases
    if rule_type == "not":
        return extract_rule_aliases(rule.condition)
    return set()
