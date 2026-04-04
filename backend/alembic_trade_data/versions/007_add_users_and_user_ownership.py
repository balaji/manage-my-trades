"""Add users and user ownership to strategies/backtests.

Revision ID: 007_add_users_and_user_ownership
Revises: 006_cascade_delete_strategy
Create Date: 2026-04-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("google_sub", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("google_sub", name="uq_users_google_sub"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=False)

    op.add_column("strategies", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("backtests", sa.Column("user_id", sa.Integer(), nullable=True))

    op.execute("INSERT INTO users (google_sub, created_at, updated_at) VALUES ('legacy-user', NOW(), NOW())")
    op.execute("UPDATE strategies SET user_id = (SELECT id FROM users WHERE google_sub = 'legacy-user')")
    op.execute("UPDATE backtests SET user_id = (SELECT id FROM users WHERE google_sub = 'legacy-user')")

    op.alter_column("strategies", "user_id", nullable=False)
    op.alter_column("backtests", "user_id", nullable=False)

    op.create_foreign_key("strategies_user_id_fkey", "strategies", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("backtests_user_id_fkey", "backtests", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_unique_constraint("uq_strategies_user_id_name", "strategies", ["user_id", "name"])

    # op.drop_constraint("strategies_name_key", "strategies", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("strategies_name_key", "strategies", ["name"])
    op.drop_constraint("uq_strategies_user_id_name", "strategies", type_="unique")
    op.drop_constraint("backtests_user_id_fkey", "backtests", type_="foreignkey")
    op.drop_constraint("strategies_user_id_fkey", "strategies", type_="foreignkey")
    op.drop_column("backtests", "user_id")
    op.drop_column("strategies", "user_id")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
