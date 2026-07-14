"""ingestion keys

Revision ID: 0002_ingestion_keys
Revises: 0001_core
"""
from alembic import op

revision = "0002_ingestion_keys"
down_revision = "0001_core"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("uq_own_posts_source_id", "own_posts", type_="unique")
    op.create_unique_constraint("uq_own_posts_source_window", "own_posts", ["source_id", "window_date"])
    op.drop_constraint("uq_keyword_volumes_source_id", "keyword_volumes", type_="unique")
    op.create_unique_constraint("uq_keyword_volumes_source_window", "keyword_volumes", ["source_id", "window_date"])


def downgrade():
    op.drop_constraint("uq_own_posts_source_window", "own_posts", type_="unique")
    op.create_unique_constraint("uq_own_posts_source_id", "own_posts", ["source_id"])
    op.drop_constraint("uq_keyword_volumes_source_window", "keyword_volumes", type_="unique")
    op.create_unique_constraint("uq_keyword_volumes_source_id", "keyword_volumes", ["source_id"])
