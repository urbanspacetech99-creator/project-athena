"""competitor engagement counts: like_count, comment_count

Revision ID: 0005_competitor_engagement
Revises: 0004_config_tables
"""
import sqlalchemy as sa
from alembic import op

revision = "0005_competitor_engagement"
down_revision = "0004_config_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("competitor_posts",
                  sa.Column("like_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("competitor_posts",
                  sa.Column("comment_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade():
    op.drop_column("competitor_posts", "comment_count")
    op.drop_column("competitor_posts", "like_count")
