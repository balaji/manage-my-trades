"""Add assets table to market_data_db

Revision ID: 003
Revises: 002
Create Date: 2026-04-12

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.Boolean(), nullable=False),
        sa.Column("exchange", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol", name="uq_assets_symbol"),
    )
    op.create_index(op.f("ix_assets_id"), "assets", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assets_id"), table_name="assets")
    op.drop_table("assets")
