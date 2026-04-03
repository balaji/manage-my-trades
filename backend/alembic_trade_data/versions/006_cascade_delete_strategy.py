"""Add ON DELETE CASCADE to backtests and trades strategy FK

Revision ID: 006
Revises: 005
Create Date: 2026-04-03

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("backtests_strategy_id_fkey", "backtests", type_="foreignkey")
    op.create_foreign_key(
        "backtests_strategy_id_fkey",
        "backtests",
        "strategies",
        ["strategy_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("trades_strategy_id_fkey", "trades", type_="foreignkey")
    op.create_foreign_key(
        "trades_strategy_id_fkey",
        "trades",
        "strategies",
        ["strategy_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("backtests_strategy_id_fkey", "backtests", type_="foreignkey")
    op.create_foreign_key(
        "backtests_strategy_id_fkey",
        "backtests",
        "strategies",
        ["strategy_id"],
        ["id"],
    )

    op.drop_constraint("trades_strategy_id_fkey", "trades", type_="foreignkey")
    op.create_foreign_key(
        "trades_strategy_id_fkey",
        "trades",
        "strategies",
        ["strategy_id"],
        ["id"],
    )
