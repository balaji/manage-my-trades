"""Helpers for adapting legacy strategy records to canonical specs."""

from __future__ import annotations

from typing import Any

from app.core.strategies.spec import (
    CompareRule,
    CrossRule,
    IndicatorExpr,
    LogicalRule,
    NotRule,
    PrevExpr,
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


def indicator_rows_from_spec(spec: StrategySpec) -> list[dict[str, Any]]:
    """Derive legacy indicator rows from a canonical spec."""

    exit_aliases = _extract_rule_aliases(spec.rules.exit)
    filter_aliases = set()
    for filter_rule in spec.rules.filters:
        filter_aliases.update(_extract_rule_aliases(filter_rule))

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


def _extract_rule_aliases(rule: Any) -> set[str]:
    """Collect indicator aliases used by a rule node."""
    if isinstance(rule, dict):
        rule_type = rule.get("type")
        if rule_type in {"compare", "cross"}:
            aliases = set()
            for expr in (rule.get("left"), rule.get("right")):
                aliases.update(_extract_expr_aliases(expr))
            return aliases
        if rule_type in {"all", "any"}:
            aliases = set()
            for child in rule.get("conditions", []):
                aliases.update(_extract_rule_aliases(child))
            return aliases
        if rule_type == "not":
            return _extract_rule_aliases(rule.get("condition"))

    rule_type = getattr(rule, "type", None)
    if isinstance(rule, (CompareRule, CrossRule)) or rule_type in {"compare", "cross"}:
        aliases = set()
        for expr in (rule.left, rule.right):
            aliases.update(_extract_expr_aliases(expr))
        return aliases
    if isinstance(rule, LogicalRule) or rule_type in {"all", "any"}:
        aliases = set()
        for child in rule.conditions:
            aliases.update(_extract_rule_aliases(child))
        return aliases
    if isinstance(rule, NotRule) or rule_type == "not":
        return _extract_rule_aliases(rule.condition)
    return set()


def _extract_expr_aliases(expr: Any) -> set[str]:
    """Collect indicator aliases referenced by an expression node."""
    if expr is None:
        return set()

    if isinstance(expr, dict):
        expr_type = expr.get("type")
        if expr_type == "indicator":
            return {expr["alias"]}
        if expr_type == "prev":
            return _extract_expr_aliases(expr.get("expr"))
        return set()

    if isinstance(expr, IndicatorExpr):
        return {expr.alias}
    if isinstance(expr, PrevExpr):
        return _extract_expr_aliases(expr.expr)
    return set()
