"""TA-Lib-backed registry of available technical indicators."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import talib
from talib import abstract

BAR_INPUT_FIELDS = {"open", "high", "low", "close", "volume"}

DEFAULT_CHART_CONFIGS: dict[str, dict[str, Any]] = {
    "SMA": {
        "default_enabled": True,
        "default_params_presets": [{"timeperiod": 10}, {"timeperiod": 20}, {"timeperiod": 30}],
    },
    "EMA": {
        "default_enabled": False,
        "default_params_presets": [{"timeperiod": 10}, {"timeperiod": 20}, {"timeperiod": 30}],
    },
    "RSI": {
        "default_enabled": True,
        "default_params_presets": [{"timeperiod": 14}],
        "reference_lines": [
            {"value": 70, "color": "#ef4444"},
            {"value": 30, "color": "#22c55e"},
        ],
    },
    "STOCH": {
        "default_enabled": False,
        "reference_lines": [
            {"value": 80, "color": "#ef4444"},
            {"value": 20, "color": "#22c55e"},
        ],
    },
    "STOCHF": {
        "default_enabled": False,
        "reference_lines": [
            {"value": 80, "color": "#ef4444"},
            {"value": 20, "color": "#22c55e"},
        ],
    },
    "BBANDS": {
        "default_enabled": False,
        "default_params_presets": [{"timeperiod": 20, "nbdevup": 2, "nbdevdn": 2}],
        "output_labels": {
            "upperband": "Upper",
            "middleband": "Middle",
            "lowerband": "Lower",
        },
    },
}


def _normalize_input_names(input_names: Any) -> list[str]:
    if isinstance(input_names, dict):
        values = input_names.values()
    else:
        values = input_names

    normalized: list[str] = []
    for value in values:
        if isinstance(value, str):
            normalized.append(value)
        else:
            normalized.extend(list(value))
    return normalized


def _build_parameter_definition(name: str, default: Any) -> dict[str, Any]:
    param_type = "number"
    if isinstance(default, int) and not isinstance(default, bool):
        param_type = "integer"
    elif isinstance(default, float):
        param_type = "number"

    return {
        "name": name,
        "label": name.replace("_", " ").title(),
        "description": f"TA-Lib parameter `{name}`.",
        "type": param_type,
        "default": default,
        "required": False,
    }


def _build_chart_definition(name: str, group: str | None) -> dict[str, Any]:
    chart = {
        "pane": "overlay" if group == "Overlap Studies" else "oscillator",
        "default_enabled": False,
        "default_params_presets": [],
        "reference_lines": [],
        "output_labels": {},
    }
    chart.update(DEFAULT_CHART_CONFIGS.get(name, {}))
    return chart


@lru_cache(maxsize=1)
def get_all_indicators() -> list[dict[str, Any]]:
    """Return the full TA-Lib indicator catalog supported by the app."""
    indicators: list[dict[str, Any]] = []

    for function_name in talib.get_functions():
        function = abstract.Function(function_name)
        info = function.info
        input_names = _normalize_input_names(info.get("input_names", {}))
        required_inputs = sorted(set(input_names))

        if any(field not in BAR_INPUT_FIELDS for field in required_inputs):
            continue

        parameters = [
            _build_parameter_definition(parameter_name, default)
            for parameter_name, default in info.get("parameters", {}).items()
        ]

        output_names = list(info.get("output_names", []))
        fields = output_names if len(output_names) > 1 else []

        indicators.append(
            {
                "name": function_name,
                "label": info.get("display_name") or function_name,
                "display_name": info.get("display_name") or function_name,
                "description": f"TA-Lib {info.get('group', 'Indicator')}",
                "group": info.get("group"),
                "category": info.get("group"),
                "inputs": required_inputs,
                "parameters": parameters,
                "params": parameters,
                "output_names": output_names,
                "fields": fields,
                "chart": _build_chart_definition(function_name, info.get("group")),
            }
        )

    indicators.sort(key=lambda indicator: indicator["name"])
    return indicators


@lru_cache(maxsize=1)
def get_indicator_map() -> dict[str, dict[str, Any]]:
    """Index the supported TA-Lib catalog by function name."""
    return {indicator["name"]: indicator for indicator in get_all_indicators()}
