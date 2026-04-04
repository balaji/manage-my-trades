"""Add user profile columns."""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("picture", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "picture")
    op.drop_column("users", "name")
