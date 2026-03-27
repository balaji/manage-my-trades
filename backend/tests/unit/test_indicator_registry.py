"""Unit tests for supported indicator registry metadata."""

from app.services.indicator_registry import get_all_indicators


def test_supported_indicators_include_chart_metadata():
    indicators = {indicator["name"]: indicator for indicator in get_all_indicators()}

    sma = indicators["SMA"]
    assert sma["chart"]["pane"] == "overlay"
    assert sma["chart"]["default_enabled"] is True
    assert sma["chart"]["default_params_presets"] == [{"timeperiod": 10}, {"timeperiod": 20}, {"timeperiod": 30}]

    rsi = indicators["RSI"]
    assert rsi["chart"]["pane"] == "oscillator"
    assert rsi["chart"]["reference_lines"] == [
        {"value": 70, "color": "#ef4444"},
        {"value": 30, "color": "#22c55e"},
    ]

    bbands = indicators["BBANDS"]
    assert bbands["chart"]["pane"] == "overlay"
    assert bbands["chart"]["default_enabled"] is False
    assert bbands["chart"]["output_labels"] == {
        "upperband": "Upper",
        "middleband": "Middle",
        "lowerband": "Lower",
    }

    # Non-oscillator, non-overlay groups should use "other" pane
    floor = indicators["FLOOR"]
    assert floor["chart"]["pane"] == "other"

    add = indicators["ADD"]
    assert add["chart"]["pane"] == "other"
