"""
Static registry of available technical indicators with their metadata and parameter definitions.
"""

INDICATOR_REGISTRY = [
    {
        "name": "rsi",
        "label": "Relative Strength Index (RSI)",
        "description": "Measures overbought/oversold conditions on a 0-100 scale",
        "parameters": [
            {
                "name": "length",
                "label": "Period",
                "description": "Number of bars for RSI calculation",
                "type": "number",
                "default": 14,
            }
        ],
    },
    {
        "name": "macd",
        "label": "MACD",
        "description": "Moving Average Convergence Divergence — trend and momentum",
        "parameters": [
            {
                "name": "fast",
                "label": "Fast Period",
                "description": "Fast EMA period",
                "type": "number",
                "default": 12,
            },
            {
                "name": "slow",
                "label": "Slow Period",
                "description": "Slow EMA period",
                "type": "number",
                "default": 26,
            },
            {
                "name": "signal",
                "label": "Signal Period",
                "description": "Signal line EMA period",
                "type": "number",
                "default": 9,
            },
        ],
    },
    {
        "name": "sma",
        "label": "Simple Moving Average (SMA)",
        "description": "Average price over a fixed number of bars — trend direction",
        "parameters": [
            {
                "name": "length",
                "label": "Period",
                "description": "Number of bars for moving average",
                "type": "number",
                "default": 20,
            }
        ],
    },
    {
        "name": "ema",
        "label": "Exponential Moving Average (EMA)",
        "description": "Weighted moving average that reacts faster to recent prices",
        "parameters": [
            {
                "name": "length",
                "label": "Period",
                "description": "Number of bars for EMA calculation",
                "type": "number",
                "default": 20,
            }
        ],
    },
    {
        "name": "bollinger_bands",
        "label": "Bollinger Bands",
        "description": "Volatility bands around a moving average — identifies overbought/oversold",
        "parameters": [
            {
                "name": "length",
                "label": "Period",
                "description": "Number of bars for the middle band (SMA)",
                "type": "number",
                "default": 20,
            },
            {
                "name": "std",
                "label": "Std Deviations",
                "description": "Number of standard deviations for upper/lower bands",
                "type": "number",
                "default": 2,
            },
        ],
    },
    {
        "name": "stochastic",
        "label": "Stochastic Oscillator",
        "description": "Compares closing price to price range over a period — momentum indicator",
        "parameters": [
            {
                "name": "k",
                "label": "K Period",
                "description": "Lookback period for %K line",
                "type": "number",
                "default": 14,
            },
            {
                "name": "d",
                "label": "D Period",
                "description": "Smoothing period for %D signal line",
                "type": "number",
                "default": 3,
            },
        ],
    },
    {
        "name": "atr",
        "label": "Average True Range (ATR)",
        "description": "Measures market volatility using the range of price bars",
        "parameters": [
            {
                "name": "length",
                "label": "Period",
                "description": "Number of bars for ATR calculation",
                "type": "number",
                "default": 14,
            }
        ],
    },
]


def get_all_indicators() -> list[dict]:
    return INDICATOR_REGISTRY
