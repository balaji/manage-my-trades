"""Canonical strategy specification models and validators."""

from __future__ import annotations

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

SUPPORTED_INDICATORS = {
    "sma": {"fields": []},
    "ema": {"fields": []},
    "rsi": {"fields": []},
    "macd": {"fields": ["macd", "signal", "histogram"]},
    "bollinger_bands": {"fields": ["lower", "middle", "upper", "bandwidth", "percent_b"]},
    "stochastic": {"fields": ["k", "d"]},
    "atr": {"fields": []},
}

COMPARISON_OPERATORS = {"<", "<=", ">", ">=", "=="}


def normalize_indicator_name(name: str) -> str:
    """Normalize indicator names across legacy and spec representations."""
    normalized = name.strip().lower()
    aliases = {
        "bbands": "bollinger_bands",
        "bollinger": "bollinger_bands",
        "stoch": "stochastic",
    }
    return aliases.get(normalized, normalized)


def normalize_indicator_params(indicator: str, params: dict[str, Any]) -> dict[str, Any]:
    """Normalize parameter names to calculator-friendly keys."""
    normalized = dict(params)
    indicator = normalize_indicator_name(indicator)

    if "period" in normalized and "length" not in normalized:
        normalized["length"] = normalized.pop("period")

    if indicator == "stochastic":
        if "k_period" in normalized and "k" not in normalized:
            normalized["k"] = normalized.pop("k_period")
        if "d_period" in normalized and "d" not in normalized:
            normalized["d"] = normalized.pop("d_period")

    return normalized


class StrategyMetadata(BaseModel):
    """Human-facing strategy metadata."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: int = 1


class StrategyMarket(BaseModel):
    """Market defaults for strategy execution."""

    timeframe: str = "1d"
    symbols: list[str] = Field(default_factory=list)


class IndicatorDefinition(BaseModel):
    """Named indicator instance in a strategy spec."""

    alias: str = Field(..., min_length=1)
    indicator: str
    params: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_indicator(self) -> "IndicatorDefinition":
        self.indicator = normalize_indicator_name(self.indicator)
        self.params = normalize_indicator_params(self.indicator, self.params)
        if self.indicator not in SUPPORTED_INDICATORS:
            raise ValueError(f"Unsupported indicator '{self.indicator}'")
        return self


class ValueRef(BaseModel):
    """Reference to an indicator, price field, or constant value."""

    source: Literal["indicator", "price", "constant"]
    value: Union[str, float, int]
    field: Optional[str] = None

    @model_validator(mode="after")
    def validate_ref(self) -> "ValueRef":
        if self.source == "indicator" and not isinstance(self.value, str):
            raise ValueError("Indicator references must use a string alias")
        if self.source == "price" and self.value not in {"open", "high", "low", "close", "volume"}:
            raise ValueError("Price references must use open/high/low/close/volume")
        if self.source == "constant" and not isinstance(self.value, (int, float)):
            raise ValueError("Constant references must use a numeric value")
        return self


class ComparisonRule(BaseModel):
    """Binary comparison rule."""

    type: Literal["comparison"]
    left: ValueRef
    operator: Literal["<", "<=", ">", ">=", "=="]
    right: ValueRef


class LogicalRule(BaseModel):
    """Boolean combination of child rules."""

    type: Literal["all", "any"]
    conditions: list["RuleNode"]

    @model_validator(mode="after")
    def validate_conditions(self) -> "LogicalRule":
        if not self.conditions:
            raise ValueError(f"'{self.type}' rules require at least one condition")
        return self


class NotRule(BaseModel):
    """Negation rule."""

    type: Literal["not"]
    condition: "RuleNode"


RuleNode = Annotated[Union[ComparisonRule, LogicalRule, NotRule], Field(discriminator="type")]


class StrategyRules(BaseModel):
    """Entry/exit/filter rules."""

    entry: RuleNode
    exit: RuleNode
    filters: list[RuleNode] = Field(default_factory=list)


class PositionSizingSpec(BaseModel):
    """Strategy position sizing configuration."""

    method: Literal["fixed_percentage", "fixed_amount", "equal_weight"] = "fixed_percentage"
    percentage: Optional[float] = None
    amount: Optional[float] = None
    num_positions: Optional[int] = None

    @model_validator(mode="after")
    def validate_method_config(self) -> "PositionSizingSpec":
        if self.method == "fixed_percentage" and self.percentage is None:
            self.percentage = 0.1
        if self.method == "fixed_amount" and self.amount is None:
            self.amount = 1000.0
        if self.method == "equal_weight" and self.num_positions is None:
            self.num_positions = 5
        return self


class StrategyRisk(BaseModel):
    """Risk settings."""

    position_sizing: PositionSizingSpec = Field(default_factory=PositionSizingSpec)
    max_positions: Optional[int] = None
    long_only: bool = True


class StrategyExecution(BaseModel):
    """Execution-level assumptions."""

    commission: Optional[float] = None
    slippage: Optional[float] = None


class StrategySpec(BaseModel):
    """Canonical strategy spec."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["technical"] = "technical"
    metadata: StrategyMetadata
    market: StrategyMarket = Field(default_factory=StrategyMarket)
    indicators: list[IndicatorDefinition]
    rules: StrategyRules
    risk: StrategyRisk = Field(default_factory=StrategyRisk)
    execution: StrategyExecution = Field(default_factory=StrategyExecution)

    @model_validator(mode="after")
    def validate_aliases_and_references(self) -> "StrategySpec":
        if not self.indicators:
            raise ValueError("At least one indicator is required")

        aliases = [indicator.alias for indicator in self.indicators]
        if len(aliases) != len(set(aliases)):
            raise ValueError("Indicator aliases must be unique")

        alias_map = {indicator.alias: indicator.indicator for indicator in self.indicators}

        def _walk_rule(rule: RuleNode):
            if isinstance(rule, ComparisonRule):
                for ref in (rule.left, rule.right):
                    if ref.source != "indicator":
                        continue
                    indicator_name = alias_map.get(ref.value)
                    if indicator_name is None:
                        raise ValueError(f"Unknown indicator alias '{ref.value}'")
                    valid_fields = SUPPORTED_INDICATORS[indicator_name]["fields"]
                    if valid_fields and ref.field not in valid_fields:
                        raise ValueError(
                            f"Indicator '{ref.value}' requires one of fields {valid_fields}, got '{ref.field}'"
                        )
                    if not valid_fields and ref.field is not None:
                        raise ValueError(f"Indicator '{ref.value}' does not support nested fields")
            elif isinstance(rule, LogicalRule):
                for child in rule.conditions:
                    _walk_rule(child)
            elif isinstance(rule, NotRule):
                _walk_rule(rule.condition)

        _walk_rule(self.rules.entry)
        _walk_rule(self.rules.exit)
        for filter_rule in self.rules.filters:
            _walk_rule(filter_rule)

        return self


StrategyRules.model_rebuild()
LogicalRule.model_rebuild()
NotRule.model_rebuild()
