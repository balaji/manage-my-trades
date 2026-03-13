"""Market data initial migration

Revision ID: 001
Revises:
Create Date: 2026-03-13

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create market_data table
    op.create_table(
        "market_data",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("timeframe", sa.String(length=10), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("open", sa.Float(), nullable=False),
        sa.Column("high", sa.Float(), nullable=False),
        sa.Column("low", sa.Float(), nullable=False),
        sa.Column("close", sa.Float(), nullable=False),
        sa.Column("volume", sa.Float(), nullable=False),
        sa.Column("vwap", sa.Float(), nullable=True),
        sa.Column("trade_count", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_market_data_id"), "market_data", ["id"], unique=False)
    op.create_index(op.f("ix_market_data_symbol"), "market_data", ["symbol"], unique=False)
    op.create_index(op.f("ix_market_data_timeframe"), "market_data", ["timeframe"], unique=False)
    op.create_index(op.f("ix_market_data_trade_date"), "market_data", ["trade_date"], unique=False)
    op.create_index(
        "ix_market_data_symbol_timeframe_trade_date",
        "market_data",
        ["symbol", "timeframe", "trade_date"],
        unique=False,
    )

    # Create indicator_cache table
    op.create_table(
        "indicator_cache",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("timeframe", sa.String(length=10), nullable=False),
        sa.Column("indicator_name", sa.String(length=100), nullable=False),
        sa.Column("indicator_params_hash", sa.String(length=64), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_indicator_cache_id"), "indicator_cache", ["id"], unique=False)
    op.create_index(op.f("ix_indicator_cache_symbol"), "indicator_cache", ["symbol"], unique=False)
    op.create_index(
        op.f("ix_indicator_cache_timeframe"),
        "indicator_cache",
        ["timeframe"],
        unique=False,
    )
    op.create_index(
        op.f("ix_indicator_cache_indicator_name"),
        "indicator_cache",
        ["indicator_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_indicator_cache_timestamp"),
        "indicator_cache",
        ["timestamp"],
        unique=False,
    )
    op.create_index(
        "ix_indicator_cache_lookup",
        "indicator_cache",
        ["symbol", "timeframe", "indicator_name", "indicator_params_hash", "timestamp"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("indicator_cache")
    op.drop_table("market_data")
