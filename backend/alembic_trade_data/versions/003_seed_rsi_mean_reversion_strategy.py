"""Seed RSI Mean Reversion strategy

Revision ID: 003
Revises: 002
Create Date: 2026-03-11

"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    result = conn.execute(
        sa.text("""
            INSERT INTO strategies (name, description, strategy_type, is_active, config, created_at, updated_at)
            VALUES (
                :name,
                :description,
                'technical',
                true,
                :config,
                NOW(),
                NOW()
            )
            RETURNING id
        """),
        {
            "name": "RSI Mean Reversion",
            "description": (
                "Mean reversion strategy using RSI overbought/oversold levels. "
                "Buy signal when RSI drops below 30 (oversold). "
                "Sell signal when RSI rises above 70 (overbought). "
                "Suitable for ETFs like SPY and QQQ."
            ),
            "config": '{"entry_threshold": 30, "exit_threshold": 70, "position_size": 0.5}',
        },
    )
    strategy_id = result.fetchone()[0]

    conn.execute(
        sa.text("""
            INSERT INTO strategy_indicators (strategy_id, indicator_name, parameters, usage, created_at, updated_at)
            VALUES (:sid, 'rsi', '{"length": 14}', 'entry', NOW(), NOW())
        """),
        {"sid": strategy_id},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM strategies WHERE name = 'RSI Mean Reversion'"))
