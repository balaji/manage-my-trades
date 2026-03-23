"""Runtime evaluation for canonical strategy specs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import pandas as pd

from app.core.indicators.calculator import IndicatorCalculator
from app.core.strategies.spec import (
    CompareRule,
    ConstantExpr,
    CrossRule,
    IndicatorExpr,
    LogicalRule,
    NotRule,
    PrevExpr,
    PriceExpr,
    RuleNode,
    StrategySpec,
)


@dataclass
class StrategyRuntime:
    """Pure runtime for compiling indicators and evaluating rules."""

    spec: StrategySpec

    def generate_signals(self, bars: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Generate signal dictionaries from OHLCV bars."""
        if not bars:
            return []

        df = pd.DataFrame(bars)
        if df.empty:
            return []

        indicator_values = self._calculate_indicators(df)
        signals: list[dict[str, Any]] = []

        for index, bar in enumerate(bars):
            current_indicators = self._snapshot_indicators(index, indicator_values)

            if not all(self._evaluate_rule(rule, df, index, indicator_values) for rule in self.spec.rules.filters):
                continue

            signal_type: Optional[str] = None
            reason = None
            if self._evaluate_rule(self.spec.rules.exit, df, index, indicator_values):
                signal_type = "sell"
                reason = "Exit rule matched"
            elif self._evaluate_rule(self.spec.rules.entry, df, index, indicator_values):
                signal_type = "buy"
                reason = "Entry rule matched"

            if not signal_type:
                continue

            signals.append(
                {
                    "symbol": bar.get("symbol"),
                    "signal_type": signal_type,
                    "timestamp": bar["timestamp"],
                    "price": float(bar["close"]),
                    "strength": 1.0,
                    "indicators": current_indicators,
                    "metadata": {"reason": reason},
                }
            )

        return signals

    def _calculate_indicators(self, df: pd.DataFrame) -> dict[str, pd.Series | pd.DataFrame]:
        """Calculate all configured indicators keyed by alias."""
        calculator = IndicatorCalculator(df)
        indicator_data: dict[str, pd.Series | pd.DataFrame] = {}

        for indicator in self.spec.indicators:
            result = calculator.calculate(indicator.indicator, indicator.params)
            indicator_data[indicator.alias] = result

        return indicator_data

    def _evaluate_rule(
        self,
        rule: RuleNode,
        bars: pd.DataFrame,
        index: int,
        indicators: dict[str, pd.Series | pd.DataFrame],
    ) -> bool:
        """Evaluate a rule tree for a single bar index."""
        if isinstance(rule, CompareRule):
            left = self._resolve_expr(rule.left, bars, index, indicators)
            right = self._resolve_expr(rule.right, bars, index, indicators)
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

        if isinstance(rule, CrossRule):
            left = self._resolve_expr(rule.left, bars, index, indicators)
            right = self._resolve_expr(rule.right, bars, index, indicators)
            prev_left = self._resolve_expr(PrevExpr(type="prev", expr=rule.left), bars, index, indicators)
            prev_right = self._resolve_expr(PrevExpr(type="prev", expr=rule.right), bars, index, indicators)
            if left is None or right is None or prev_left is None or prev_right is None:
                return False
            if rule.operator == "crosses_above":
                return left > right and prev_left <= prev_right
            return left < right and prev_left >= prev_right

        if isinstance(rule, LogicalRule):
            evaluations = [self._evaluate_rule(child, bars, index, indicators) for child in rule.conditions]
            return all(evaluations) if rule.type == "all" else any(evaluations)

        if isinstance(rule, NotRule):
            return not self._evaluate_rule(rule.condition, bars, index, indicators)

        return False

    @staticmethod
    def _resolve_expr(
        expr: Any,
        bars: pd.DataFrame,
        index: int,
        indicators: dict[str, pd.Series | pd.DataFrame],
    ) -> Optional[float]:
        """Resolve a scalar expression for a given bar index."""
        if isinstance(expr, ConstantExpr):
            return float(expr.value)

        if isinstance(expr, PriceExpr):
            value = bars.iloc[index][expr.field]
            return None if pd.isna(value) else float(value)

        if isinstance(expr, IndicatorExpr):
            series_or_frame = indicators.get(expr.alias)
            if series_or_frame is None:
                return None
            if isinstance(series_or_frame, pd.DataFrame):
                if expr.field is None:
                    return None
                value = series_or_frame.iloc[index][expr.field]
                return None if pd.isna(value) else float(value)
            value = series_or_frame.iloc[index]
            return None if pd.isna(value) else float(value)

        if isinstance(expr, PrevExpr):
            if index == 0:
                return None
            return StrategyRuntime._resolve_expr(expr.expr, bars, index - 1, indicators)

        return None

    def _snapshot_indicators(
        self,
        index: int,
        indicators: dict[str, pd.Series | pd.DataFrame],
    ) -> dict[str, Any]:
        """Capture current indicator values for signal payloads."""
        snapshot: dict[str, Any] = {}
        for alias, series_or_frame in indicators.items():
            if isinstance(series_or_frame, pd.DataFrame):
                row = series_or_frame.iloc[index]
                current = {column: float(value) for column, value in row.items() if pd.notna(value)}
                snapshot[alias] = current or None
            else:
                value = series_or_frame.iloc[index]
                snapshot[alias] = None if pd.isna(value) else float(value)
        return snapshot
