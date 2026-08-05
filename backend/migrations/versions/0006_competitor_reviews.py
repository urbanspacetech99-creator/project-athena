"""competitor_reviews table (Google Places competitor reviews)

Revision ID: 0006_competitor_reviews
Revises: 0005_competitor_engagement
"""
import sqlalchemy as sa
from alembic import op

revision = "0006_competitor_reviews"
down_revision = "0005_competitor_engagement"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "competitor_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.String(length=128), nullable=False),
        sa.Column("window_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("competitor", sa.String(length=128), nullable=False),
        sa.Column("star_rating", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("reviewer", sa.String(length=256), nullable=False, server_default=""),
        sa.Column("place_rating", sa.Float(), nullable=False, server_default="0"),
        sa.Column("place_review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("source_id", name="uq_competitor_reviews_source_id"),
    )
    op.create_index("ix_competitor_reviews_window_date", "competitor_reviews", ["window_date"])
    op.create_index("ix_competitor_reviews_competitor", "competitor_reviews", ["competitor"])


def downgrade():
    op.drop_index("ix_competitor_reviews_competitor", table_name="competitor_reviews")
    op.drop_index("ix_competitor_reviews_window_date", table_name="competitor_reviews")
    op.drop_table("competitor_reviews")
