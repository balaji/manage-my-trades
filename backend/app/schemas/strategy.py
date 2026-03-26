"""
Strategy schemas for API requests and responses.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

from app.core.strategies.legacy import build_legacy_spec
from app.core.strategies.spec import StrategySpec


class StrategyType(str, Enum):
    """Strategy type enumeration."""

    TECHNICAL = "technical"
    ML = "ml"
    COMBINED = "combined"


class SignalType(str, Enum):
    """Signal type enumeration."""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class StrategyCreate(BaseModel):
    """Schema for creating a new strategy."""

    name: str = Field(..., min_length=1, max_length=255, description="Unique strategy name")
    description: Optional[str] = Field(None, description="Strategy description")
    strategy_type: StrategyType = Field(default=StrategyType.TECHNICAL, description="Type of strategy")
    spec: Optional[StrategySpec] = Field(None, description="Canonical strategy specification")
    config: dict = Field(default_factory=dict, description="Legacy strategy configuration")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate strategy name."""
        if not v or v.strip() == "":
            raise ValueError("Strategy name cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def ensure_spec(self) -> "StrategyCreate":
        if self.spec is None:
            self.spec = build_legacy_spec(
                config=self.config,
            )
        self.config = self.spec.model_dump(mode="json")
        self.strategy_type = StrategyType.TECHNICAL
        return self

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "name": "RSI Mean Reversion",
                "description": "Buy when RSI < 30, sell when RSI > 70",
                "strategy_type": "technical",
                "spec": {
                    "kind": "technical",
                    "metadata": {
                        "name": "RSI Mean Reversion",
                        "description": "Buy when RSI < 30, sell when RSI > 70",
                    },
                    "market": {"timeframe": "1d"},
                    "indicators": [{"alias": "rsi_fast", "indicator": "RSI", "params": {"timeperiod": 14}}],
                    "rules": {
                        "entry": {
                            "type": "compare",
                            "left": {"type": "indicator", "alias": "rsi_fast"},
                            "operator": "<",
                            "right": {"type": "constant", "value": 30},
                        },
                        "exit": {
                            "type": "compare",
                            "left": {"type": "indicator", "alias": "rsi_fast"},
                            "operator": ">",
                            "right": {"type": "constant", "value": 70},
                        },
                        "filters": [],
                    },
                    "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                    "execution": {},
                },
            }
        },
    )


class StrategyUpdate(BaseModel):
    """Schema for updating an existing strategy."""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Strategy name")
    description: Optional[str] = Field(None, description="Strategy description")
    strategy_type: Optional[StrategyType] = Field(None, description="Type of strategy")
    is_active: Optional[bool] = Field(None, description="Whether the strategy is active")
    spec: Optional[StrategySpec] = Field(None, description="Canonical strategy specification")
    config: Optional[dict] = Field(None, description="Strategy-specific configuration")

    @model_validator(mode="after")
    def normalize_spec(self) -> "StrategyUpdate":
        if self.spec is not None:
            self.config = self.spec.model_dump(mode="json")
            self.strategy_type = StrategyType.TECHNICAL
        return self

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "name": "Updated RSI Strategy",
                "is_active": True,
                "spec": {
                    "kind": "technical",
                    "metadata": {"name": "Updated RSI Strategy"},
                    "market": {"timeframe": "1d"},
                    "indicators": [{"alias": "rsi_fast", "indicator": "RSI", "params": {"timeperiod": 14}}],
                    "rules": {
                        "entry": {
                            "type": "compare",
                            "left": {"type": "indicator", "alias": "rsi_fast"},
                            "operator": "<",
                            "right": {"type": "constant", "value": 35},
                        },
                        "exit": {
                            "type": "compare",
                            "left": {"type": "indicator", "alias": "rsi_fast"},
                            "operator": ">",
                            "right": {"type": "constant", "value": 65},
                        },
                        "filters": [],
                    },
                },
            }
        },
    )


class StrategyResponse(BaseModel):
    """Response schema for strategy."""

    id: int
    name: str
    description: Optional[str]
    strategy_type: str
    is_active: bool
    spec: StrategySpec
    config: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "RSI Mean Reversion",
                "description": "Buy when RSI < 30, sell when RSI > 70",
                "strategy_type": "technical",
                "is_active": True,
                "spec": {
                    "kind": "technical",
                    "metadata": {"name": "RSI Mean Reversion"},
                    "market": {"timeframe": "1d"},
                    "indicators": [{"alias": "rsi_fast", "indicator": "RSI", "params": {"timeperiod": 14}}],
                    "rules": {
                        "entry": {
                            "type": "compare",
                            "left": {"type": "indicator", "alias": "rsi_fast"},
                            "operator": "<",
                            "right": {"type": "constant", "value": 30},
                        },
                        "exit": {
                            "type": "compare",
                            "left": {"type": "indicator", "alias": "rsi_fast"},
                            "operator": ">",
                            "right": {"type": "constant", "value": 70},
                        },
                        "filters": [],
                    },
                    "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}},
                    "execution": {},
                },
                "config": {},
                "created_at": "2024-01-15T10:00:00",
                "updated_at": "2024-01-15T10:00:00",
            }
        }


class StrategyListResponse(BaseModel):
    """Response schema for listing strategies."""

    strategies: List[StrategyResponse]
    total: int

    class Config:
        json_schema_extra = {"example": {"strategies": [], "total": 0}}


class SignalResponse(BaseModel):
    """Response schema for trading signal."""

    id: int
    backtest_result_id: int
    symbol: str
    signal_type: str
    timestamp: date
    price: float
    strength: Optional[float]
    indicators: dict
    metadata_: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "backtest_result_id": 1,
                "symbol": "SPY",
                "signal_type": "buy",
                "timestamp": "2024-01-15T14:30:00",
                "price": 450.25,
                "strength": 0.85,
                "indicators": {"rsi": 28.5},
                "metadata_": {"reason": "RSI below entry threshold"},
                "created_at": "2024-01-15T14:30:05",
                "updated_at": "2024-01-15T14:30:05",
            }
        }


class SignalListResponse(BaseModel):
    """Response schema for listing signals."""

    signals: List[SignalResponse]
    total: int

    class Config:
        json_schema_extra = {"example": {"signals": [], "total": 0}}


class StrategyCompileRequest(BaseModel):
    """Natural-language compilation request."""

    prompt: str = Field(..., min_length=1)
    name: Optional[str] = None
    description: Optional[str] = None


class StrategyCompileResponse(BaseModel):
    """Compiled strategy preview response."""

    normalized_spec: StrategySpec
    summary: str
    warnings: List[str] = Field(default_factory=list)
    prompt_warnings: List[str] = Field(default_factory=list)
