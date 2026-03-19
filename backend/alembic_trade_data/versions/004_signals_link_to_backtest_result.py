"""Re-associate signals with backtest results

Revision ID: 004
Revises: 003
Create Date: 2026-03-19

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Delete all existing signals (they are orphaned without valid backtest_result_id)
    op.execute("DELETE FROM signals")

    # Drop foreign key constraint on strategy_id
    op.drop_constraint("signals_strategy_id_fkey", "signals", type_="foreignkey")

    # Drop strategy_id column
    op.drop_column("signals", "strategy_id")

    # Add backtest_result_id column with foreign key to backtest_results
    op.add_column(
        "signals",
        sa.Column("backtest_result_id", sa.Integer(), nullable=False),
    )
    op.create_foreign_key(
        "signals_backtest_result_id_fkey",
        "signals",
        "backtest_results",
        ["backtest_result_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Create index on backtest_result_id
    op.create_index(op.f("ix_signals_backtest_result_id"), "signals", ["backtest_result_id"], unique=False)


def downgrade() -> None:
    # Drop index on backtest_result_id
    op.drop_index(op.f("ix_signals_backtest_result_id"), table_name="signals")

    # Drop foreign key constraint on backtest_result_id
    op.drop_constraint("signals_backtest_result_id_fkey", "signals", type_="foreignkey")

    # Drop backtest_result_id column
    op.drop_column("signals", "backtest_result_id")

    # Add strategy_id column back
    op.add_column(
        "signals",
        sa.Column("strategy_id", sa.Integer(), nullable=False),
    )
    op.create_foreign_key(
        "signals_strategy_id_fkey",
        "signals",
        "strategies",
        ["strategy_id"],
        ["id"],
    )
