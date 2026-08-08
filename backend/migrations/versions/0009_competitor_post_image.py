"""competitor_posts.image_b64/permalink/is_video — same treatment as own_posts, scoped
to Instagram competitors (Facebook competitor access is currently blocked by PPCA).

Revision ID: 0009_competitor_post_image
Revises: 0008_own_post_image
"""
import sqlalchemy as sa
from alembic import op

revision = "0009_competitor_post_image"
down_revision = "0008_own_post_image"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("competitor_posts",
        sa.Column("image_b64", sa.Text(), nullable=False, server_default=""))
    op.add_column("competitor_posts",
        sa.Column("permalink", sa.String(length=512), nullable=False, server_default=""))
    op.add_column("competitor_posts",
        sa.Column("is_video", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("competitor_posts", "is_video")
    op.drop_column("competitor_posts", "permalink")
    op.drop_column("competitor_posts", "image_b64")