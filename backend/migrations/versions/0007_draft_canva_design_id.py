"""saved_drafts.canva_design_id — the edit_url path segment is an opaque access token, not
the canonical design id needed for Canva's Export API; must be captured at creation time.

Revision ID: 0007_draft_canva_design_id
Revises: 0006_competitor_reviews
"""
import sqlalchemy as sa
from alembic import op

revision = "0007_draft_canva_design_id"
down_revision = "0006_competitor_reviews"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("saved_drafts",
        sa.Column("canva_design_id", sa.String(length=128), nullable=False, server_default=""))


def downgrade():
    op.drop_column("saved_drafts", "canva_design_id")