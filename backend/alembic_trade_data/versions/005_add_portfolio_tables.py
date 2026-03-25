"""Add portfolio management tables

Revision ID: 005
Revises: 004
Create Date: 2026-03-25

"""

import sqlalchemy as sa
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("portfolio_type", sa.String(length=20), nullable=False),
        sa.Column("initial_capital", sa.Float(), nullable=False),
        sa.Column("current_cash", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolios_id"), "portfolios", ["id"], unique=False)
    op.create_index(op.f("ix_portfolios_name"), "portfolios", ["name"], unique=True)

    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("avg_entry_price", sa.Float(), nullable=False),
        sa.Column("current_price", sa.Float(), nullable=True),
        sa.Column("market_value", sa.Float(), nullable=True),
        sa.Column("cost_basis", sa.Float(), nullable=False),
        sa.Column("unrealized_pnl", sa.Float(), nullable=True),
        sa.Column("unrealized_pnl_pct", sa.Float(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=True),
        sa.Column("side", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("portfolio_id", "symbol", name="uq_portfolio_position_symbol"),
    )
    op.create_index(op.f("ix_portfolio_positions_id"), "portfolio_positions", ["id"], unique=False)
    op.create_index(op.f("ix_portfolio_positions_portfolio_id"), "portfolio_positions", ["portfolio_id"], unique=False)
    op.create_index(op.f("ix_portfolio_positions_symbol"), "portfolio_positions", ["symbol"], unique=False)
    op.create_index(
        "ix_portfolio_positions_portfolio_symbol",
        "portfolio_positions",
        ["portfolio_id", "symbol"],
        unique=False,
    )

    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("equity", sa.Float(), nullable=False),
        sa.Column("cash", sa.Float(), nullable=False),
        sa.Column("positions_value", sa.Float(), nullable=False),
        sa.Column("daily_pnl", sa.Float(), nullable=True),
        sa.Column("daily_pnl_pct", sa.Float(), nullable=True),
        sa.Column("total_return", sa.Float(), nullable=True),
        sa.Column("total_return_pct", sa.Float(), nullable=True),
        sa.Column("positions_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_portfolio_snapshots_id"), "portfolio_snapshots", ["id"], unique=False)
    op.create_index(
        op.f("ix_portfolio_snapshots_portfolio_id"), "portfolio_snapshots", ["portfolio_id"], unique=False
    )
    op.create_index(op.f("ix_portfolio_snapshots_timestamp"), "portfolio_snapshots", ["timestamp"], unique=False)

    op.create_table(
        "portfolio_metrics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("portfolio_id", sa.Integer(), nullable=False),
        sa.Column("total_return", sa.Float(), nullable=True),
        sa.Column("total_return_pct", sa.Float(), nullable=True),
        sa.Column("sharpe_ratio", sa.Float(), nullable=True),
        sa.Column("sortino_ratio", sa.Float(), nullable=True),
        sa.Column("max_drawdown", sa.Float(), nullable=True),
        sa.Column("max_drawdown_pct", sa.Float(), nullable=True),
        sa.Column("win_rate", sa.Float(), nullable=True),
        sa.Column("profit_factor", sa.Float(), nullable=True),
        sa.Column("volatility", sa.Float(), nullable=True),
        sa.Column("total_trades", sa.Integer(), nullable=True),
        sa.Column("calculated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["portfolio_id"], ["portfolios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("portfolio_id", name="uq_portfolio_metrics_portfolio_id"),
    )
    op.create_index(op.f("ix_portfolio_metrics_id"), "portfolio_metrics", ["id"], unique=False)


def downgrade() -> None:
    op.drop_table("portfolio_metrics")
    op.drop_table("portfolio_snapshots")
    op.drop_index("ix_portfolio_positions_portfolio_symbol", table_name="portfolio_positions")
    op.drop_table("portfolio_positions")
    op.drop_index(op.f("ix_portfolios_name"), table_name="portfolios")
    op.drop_table("portfolios")
