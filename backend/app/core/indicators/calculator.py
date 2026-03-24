"""TA-Lib-backed indicator calculation engine."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import pandas as pd
from talib import abstract

from app.services.indicator_registry import get_all_indicators, get_indicator_map

logger = logging.getLogger(__name__)


class IndicatorCalculator:
    """Calculator for TA-Lib technical indicators."""

    def __init__(self, df: pd.DataFrame):
        """Initialize calculator with OHLCV data."""
        self.df = df.copy()
        self.df["timestamp"] = pd.to_datetime(self.df["timestamp"])
        self.df.set_index("timestamp", inplace=True)
        self.df.sort_index(inplace=True)
        self.inputs = {
            column: self.df[column].astype(float)
            for column in ("open", "high", "low", "close", "volume")
            if column in self.df.columns
        }

    @staticmethod
    def create_hash(indicator_name: str, params: dict[str, Any]) -> str:
        """Create a deterministic hash for an indicator request."""
        data = f"{indicator_name}:{json.dumps(params, sort_keys=True)}"
        return hashlib.sha256(data.encode()).hexdigest()

    def calculate(self, indicator_name: str, params: dict[str, Any] | None = None) -> pd.Series | pd.DataFrame:
        """Calculate a TA-Lib indicator."""
        normalized_name = indicator_name.upper()
        indicator = get_indicator_map().get(normalized_name)
        if indicator is None:
            raise ValueError(f"Unsupported indicator: {normalized_name}")

        params = self._normalize_params(indicator, params or {})
        missing_inputs = [field for field in indicator["inputs"] if field not in self.inputs]
        if missing_inputs:
            raise ValueError(f"Indicator {normalized_name} requires inputs not available in bars: {missing_inputs}")

        try:
            function = abstract.Function(normalized_name)
            result = function(self.inputs, **params)
        except Exception as exc:
            logger.error("Error calculating %s: %s", normalized_name, exc)
            raise

        output_names = indicator["output_names"]
        if isinstance(result, pd.Series):
            return result.rename(output_names[0] if output_names else normalized_name)

        if isinstance(result, pd.DataFrame):
            if len(result.columns) == len(output_names):
                return result.set_axis(output_names, axis="columns")
            return result

        if isinstance(result, list | tuple):
            frame = pd.concat(
                [
                    pd.Series(output, index=self.df.index, name=output_name)
                    for output_name, output in zip(output_names, result, strict=False)
                ],
                axis=1,
            )
            return frame

        return pd.Series(result, index=self.df.index, name=output_names[0] if output_names else normalized_name)

    @staticmethod
    def _normalize_params(indicator: dict[str, Any], params: dict[str, Any]) -> dict[str, Any]:
        """Coerce request params to the types expected by TA-Lib."""
        normalized = dict(params)
        parameter_map = {parameter["name"]: parameter for parameter in indicator["parameters"]}

        for name, value in list(normalized.items()):
            parameter = parameter_map.get(name)
            if parameter is None:
                continue
            if parameter["type"] == "number" and isinstance(value, int):
                normalized[name] = float(value)
        return normalized

    def calculate_multiple(self, indicators: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Calculate multiple indicators and return a unified outputs contract."""
        results: list[dict[str, Any]] = []

        for indicator_config in indicators:
            name = indicator_config.get("name")
            params = indicator_config.get("params", {})
            if not name:
                continue

            result = self.calculate(name, params)
            outputs: dict[str, list[dict[str, Any]]] = {}

            if isinstance(result, pd.Series):
                output_name = result.name or name.upper()
                outputs[output_name] = [
                    {"timestamp": idx.isoformat(), "value": float(val)} for idx, val in result.items() if pd.notna(val)
                ]
            else:
                for column in result.columns:
                    outputs[column] = [
                        {"timestamp": idx.isoformat(), "value": float(val)}
                        for idx, val in result[column].items()
                        if pd.notna(val)
                    ]

            results.append({"name": name.upper(), "params": params, "outputs": outputs})

        return results


def get_supported_indicators() -> list[dict[str, Any]]:
    """Return the TA-Lib-backed supported indicator catalog."""
    return get_all_indicators()
