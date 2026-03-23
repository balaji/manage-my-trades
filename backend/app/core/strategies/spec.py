"""Canonical strategy specification models and validators."""

from __future__ import annotations

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.services.indicator_registry import get_indicator_map

PRICE_FIELDS = {"open", "high", "low", "close", "volume"}
COMPARISON_OPERATORS = {"<", "<=", ">", ">=", "=="}
CROSS_OPERATORS = {"crosses_above", "crosses_below"}


class StrategyMetadata(BaseModel):
    """Human-facing strategy metadata."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: int = 1


class StrategyMarket(BaseModel):
    """Market defaults for strategy execution."""

    timeframe: str = "1d"


class IndicatorDefinition(BaseModel):
    """Named indicator instance in a strategy spec."""

    alias: str = Field(..., min_length=1)
    indicator: str
    params: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_indicator(self) -> "IndicatorDefinition":
        if self.indicator not in get_indicator_map():
            raise ValueError(f"Unsupported indicator '{self.indicator}'")
        return self


class IndicatorExpr(BaseModel):
    """Reference to an indicator output."""

    type: Literal["indicator"]
    alias: str = Field(..., min_length=1)
    field: Optional[str] = None


class PriceExpr(BaseModel):
    """Reference to a price or volume field."""

    type: Literal["price"]
    field: Literal["open", "high", "low", "close", "volume"]


class ConstantExpr(BaseModel):
    """Numeric constant in a strategy expression."""

    type: Literal["constant"]
    value: float | int


class PrevExpr(BaseModel):
    """One-bar lookback of another scalar expression."""

    type: Literal["prev"]
    expr: "ExpressionNode"


ExpressionNode = Annotated[Union[IndicatorExpr, PriceExpr, ConstantExpr, PrevExpr], Field(discriminator="type")]


class CompareRule(BaseModel):
    """Binary scalar comparison rule."""

    type: Literal["compare"]
    left: ExpressionNode
    operator: Literal["<", "<=", ">", ">=", "=="]
    right: ExpressionNode


class CrossRule(BaseModel):
    """Crossover/crossunder event rule."""

    type: Literal["cross"]
    left: ExpressionNode
    operator: Literal["crosses_above", "crosses_below"]
    right: ExpressionNode


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


RuleNode = Annotated[Union[CompareRule, CrossRule, LogicalRule, NotRule], Field(discriminator="type")]


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
        # Normalize percentage expressed as whole number (e.g. 10.0 → 0.1)
        if self.percentage is not None and self.percentage > 1.0:
            self.percentage = self.percentage / 100.0
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

        def _validate_expr(expr: ExpressionNode) -> None:
            if isinstance(expr, IndicatorExpr):
                indicator_name = alias_map.get(expr.alias)
                if indicator_name is None:
                    raise ValueError(f"Unknown indicator alias '{expr.alias}'")

                valid_fields = get_indicator_map()[indicator_name]["fields"]
                if valid_fields and expr.field not in valid_fields:
                    raise ValueError(
                        f"Indicator '{expr.alias}' requires one of fields {valid_fields}, got '{expr.field}'"
                    )
                if not valid_fields and expr.field is not None:
                    raise ValueError(f"Indicator '{expr.alias}' does not support nested fields")
                return

            if isinstance(expr, PriceExpr):
                if expr.field not in PRICE_FIELDS:
                    raise ValueError("Price references must use open/high/low/close/volume")
                return

            if isinstance(expr, ConstantExpr):
                if not isinstance(expr.value, (int, float)):
                    raise ValueError("Constant expressions must use a numeric value")
                return

            if isinstance(expr, PrevExpr):
                if isinstance(expr.expr, PrevExpr):
                    raise ValueError("Nested prev() expressions are not supported")
                _validate_expr(expr.expr)
                return

        def _walk_rule(rule: RuleNode) -> None:
            if isinstance(rule, CompareRule):
                _validate_expr(rule.left)
                _validate_expr(rule.right)
                return

            if isinstance(rule, CrossRule):
                _validate_expr(rule.left)
                _validate_expr(rule.right)
                return

            if isinstance(rule, LogicalRule):
                for child in rule.conditions:
                    _walk_rule(child)
                return

            if isinstance(rule, NotRule):
                _walk_rule(rule.condition)

        _walk_rule(self.rules.entry)
        _walk_rule(self.rules.exit)
        for filter_rule in self.rules.filters:
            _walk_rule(filter_rule)

        return self


StrategyRules.model_rebuild()
LogicalRule.model_rebuild()
NotRule.model_rebuild()
PrevExpr.model_rebuild()
