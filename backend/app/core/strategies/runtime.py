"""Runtime evaluation for canonical strategy specs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import pandas as pd

from app.core.indicators.calculator import IndicatorCalculator
from app.core.strategies.spec import ComparisonRule, LogicalRule, NotRule, RuleNode, StrategySpec


@dataclass
class StrategyRuntime:
    """Pure runtime for compiling indicators and evaluating rules."""

    spec: StrategySpec

    def generate_signals(self, bars: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Generate signal dictionaries from OHLCV bars."""
        if not bars:
            return []

        indicator_values = self._calculate_indicators(bars)
        signals: list[dict[str, Any]] = []

        for bar in bars:
            timestamp = bar["timestamp"]
            current_indicators = {alias: values.get(timestamp) for alias, values in indicator_values.items()}

            if not all(self._evaluate_rule(rule, bar, current_indicators) for rule in self.spec.rules.filters):
                continue

            signal_type: Optional[str] = None
            reason = None
            if self._evaluate_rule(self.spec.rules.exit, bar, current_indicators):
                signal_type = "sell"
                reason = "Exit rule matched"
            elif self._evaluate_rule(self.spec.rules.entry, bar, current_indicators):
                signal_type = "buy"
                reason = "Entry rule matched"

            if not signal_type:
                continue

            signals.append(
                {
                    "symbol": bar.get("symbol"),
                    "signal_type": signal_type,
                    "timestamp": timestamp,
                    "price": float(bar["close"]),
                    "strength": 1.0,
                    "indicators": current_indicators,
                    "metadata": {"reason": reason},
                }
            )

        return signals

    def _calculate_indicators(self, bars: list[dict[str, Any]]) -> dict[str, dict[Any, Any]]:
        """Calculate all configured indicators keyed by alias and timestamp."""
        df = pd.DataFrame(bars)
        calculator = IndicatorCalculator(df)
        indicator_data: dict[str, dict[Any, Any]] = {}

        for indicator in self.spec.indicators:
            result = calculator.calculate(indicator.indicator, indicator.params)
            if isinstance(result, pd.Series):
                indicator_data[indicator.alias] = {
                    idx: float(value) for idx, value in result.items() if pd.notna(value)
                }
            else:
                indicator_data[indicator.alias] = self._normalize_dataframe_indicator(indicator.indicator, result)

        return indicator_data

    def _normalize_dataframe_indicator(self, indicator_name: str, result: pd.DataFrame) -> dict[Any, dict[str, float]]:
        """Normalize multi-column indicator outputs to stable field names."""
        if indicator_name == "macd":
            field_map = {
                result.columns[0]: "macd",
                result.columns[1]: "histogram",
                result.columns[2]: "signal",
            }
        elif indicator_name == "bollinger_bands":
            field_map = {
                result.columns[0]: "lower",
                result.columns[1]: "middle",
                result.columns[2]: "upper",
                result.columns[3]: "bandwidth",
                result.columns[4]: "percent_b",
            }
        elif indicator_name == "stochastic":
            field_map = {
                result.columns[0]: "k",
                result.columns[1]: "d",
            }
        else:
            field_map = {column: column for column in result.columns}

        values: dict[Any, dict[str, float]] = {}
        for idx, row in result.iterrows():
            normalized_row = {
                field_map[column]: float(row[column]) for column in result.columns if pd.notna(row[column])
            }
            if normalized_row:
                values[idx] = normalized_row
        return values

    def _evaluate_rule(self, rule: RuleNode, bar: dict[str, Any], indicators: dict[str, Any]) -> bool:
        """Evaluate a rule tree for a single bar."""
        if isinstance(rule, ComparisonRule):
            left = self._resolve_value(rule.left, bar, indicators)
            right = self._resolve_value(rule.right, bar, indicators)
            if left is None or right is None:
                return False
            if rule.operator == "<":
                return left < right
            if rule.operator == "<=":
                return left <= right
            if rule.operator == ">":
                return left > right
            if rule.operator == ">=":
                return left >= right
            return left == right

        if isinstance(rule, LogicalRule):
            evaluations = [self._evaluate_rule(child, bar, indicators) for child in rule.conditions]
            return all(evaluations) if rule.type == "all" else any(evaluations)

        if isinstance(rule, NotRule):
            return not self._evaluate_rule(rule.condition, bar, indicators)

        return False

    @staticmethod
    def _resolve_value(ref: Any, bar: dict[str, Any], indicators: dict[str, Any]) -> Optional[float]:
        """Resolve a rule value reference to a numeric value."""
        if ref.source == "constant":
            return float(ref.value)
        if ref.source == "price":
            value = bar.get(str(ref.value))
            return None if value is None else float(value)
        indicator_value = indicators.get(str(ref.value))
        if indicator_value is None:
            return None
        if isinstance(indicator_value, dict):
            if ref.field is None:
                return None
            nested = indicator_value.get(ref.field)
            return None if nested is None else float(nested)
        return float(indicator_value)
