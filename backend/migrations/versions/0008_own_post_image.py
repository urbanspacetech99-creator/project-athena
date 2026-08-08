"""own_posts.image_b64/permalink/is_video — store the post's image (Meta's URLs expire,
so we keep our own copy), plus a durable link to the original post and a video/reel flag.

Revision ID: 0008_own_post_image
Revises: 0007_draft_canva_design_id
"""
import sqlalchemy as sa
from alembic import op

revision = "0008_own_post_image"
down_revision = "0007_draft_canva_design_id"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("own_posts",
        sa.Column("image_b64", sa.Text(), nullable=False, server_default=""))
    op.add_column("own_posts",
        sa.Column("permalink", sa.String(length=512), nullable=False, server_default=""))
    op.add_column("own_posts",
        sa.Column("is_video", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("own_posts", "is_video")
    op.drop_column("own_posts", "permalink")
    op.drop_column("own_posts", "image_b64")