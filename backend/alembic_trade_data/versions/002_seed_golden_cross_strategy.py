"""Seed Golden Cross strategy

Revision ID: 002
Revises: 001
Create Date: 2026-03-06

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
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
                '{}',
                NOW(),
                NOW()
            )
            RETURNING id
        """),
        {
            "name": "Golden Cross",
            "description": (
                "Trend-following strategy using EMA/SMA crossover. "
                "Buy signal when the 50-period EMA crosses above the 200-period SMA (golden cross). "
                "Sell signal when the 50-period EMA drops below the 200-period SMA (death cross). "
                "Suitable for ETFs like SPY and QQQ."
            ),
        },
    )
    strategy_id = result.fetchone()[0]

    conn.execute(
        sa.text("""
            INSERT INTO strategy_indicators (strategy_id, indicator_name, parameters, usage, created_at, updated_at)
            VALUES
                (:sid, 'ema', '{"length": 50}', 'entry', NOW(), NOW()),
                (:sid, 'sma', '{"length": 200}', 'exit', NOW(), NOW())
        """),
        {"sid": strategy_id},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM strategies WHERE name = 'Golden Cross'"))
