"""Add unique constraint on market_data (symbol, timeframe, trade_date)

Revision ID: 002
Revises: 001
Create Date: 2026-03-19

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add unique constraint on market_data for idempotent bulk inserts
    op.create_unique_constraint(
        "uq_market_data_symbol_timeframe_trade_date",
        "market_data",
        ["symbol", "timeframe", "trade_date"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_market_data_symbol_timeframe_trade_date",
        "market_data",
        type_="unique",
    )
