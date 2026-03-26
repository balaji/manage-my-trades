"""Drop legacy strategy_indicators table.

Revision ID: 005
Revises: 004
Create Date: 2026-03-26
"""

from alembic import op
import json
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            UPDATE strategies
            SET config = :config, updated_at = NOW()
            WHERE name = 'Golden Cross'
            """
        ),
        {
            "config": json.dumps(
                {
                    "kind": "technical",
                    "metadata": {
                        "name": "Golden Cross",
                        "description": (
                            "Trend-following strategy using EMA/SMA crossover. "
                            "Buy signal when the 50-period EMA crosses above the 200-period SMA (golden cross). "
                            "Sell signal when the 50-period EMA drops below the 200-period SMA (death cross). "
                            "Suitable for ETFs like SPY and QQQ."
                        ),
                        "version": 1,
                    },
                    "market": {"timeframe": "1d"},
                    "indicators": [
                        {"alias": "fast_ma", "indicator": "EMA", "params": {"timeperiod": 50}},
                        {"alias": "slow_ma", "indicator": "SMA", "params": {"timeperiod": 200}},
                    ],
                    "rules": {
                        "entry": {
                            "type": "cross",
                            "left": {"type": "indicator", "alias": "fast_ma"},
                            "operator": "crosses_above",
                            "right": {"type": "indicator", "alias": "slow_ma"},
                        },
                        "exit": {
                            "type": "cross",
                            "left": {"type": "indicator", "alias": "fast_ma"},
                            "operator": "crosses_below",
                            "right": {"type": "indicator", "alias": "slow_ma"},
                        },
                        "filters": [],
                    },
                    "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}, "long_only": True},
                    "execution": {},
                }
            )
        },
    )
    conn.execute(
        sa.text(
            """
            UPDATE strategies
            SET config = :config, updated_at = NOW()
            WHERE name = 'RSI Mean Reversion'
            """
        ),
        {
            "config": json.dumps(
                {
                    "kind": "technical",
                    "metadata": {
                        "name": "RSI Mean Reversion",
                        "description": (
                            "Mean reversion strategy using RSI overbought/oversold levels. "
                            "Buy signal when RSI drops below 30 (oversold). "
                            "Sell signal when RSI rises above 70 (overbought). "
                            "Suitable for ETFs like SPY and QQQ."
                        ),
                        "version": 1,
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
                    "risk": {"position_sizing": {"method": "fixed_percentage", "percentage": 0.1}, "long_only": True},
                    "execution": {},
                }
            )
        },
    )
    op.drop_index(op.f("ix_strategy_indicators_id"), table_name="strategy_indicators")
    op.drop_table("strategy_indicators")


def downgrade() -> None:
    op.create_table(
        "strategy_indicators",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("strategy_id", sa.Integer(), nullable=False),
        sa.Column("indicator_name", sa.String(length=100), nullable=False),
        sa.Column("parameters", postgresql.JSON(astext_type=sa.Text()), nullable=False, default={}),
        sa.Column("usage", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["strategy_id"], ["strategies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_strategy_indicators_id"), "strategy_indicators", ["id"], unique=False)
