"""generate columns: image_b64, canva_edit_url, visual_style

Revision ID: 0003_generate_columns
Revises: 0002_ingestion_keys
"""
import sqlalchemy as sa
from alembic import op

revision = "0003_generate_columns"
down_revision = "0002_ingestion_keys"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("saved_drafts",
                  sa.Column("image_b64", sa.Text(), nullable=False, server_default=""))
    op.add_column("saved_drafts",
                  sa.Column("canva_edit_url", sa.String(length=1024), nullable=False,
                            server_default=""))
    op.add_column("generated_posts",
                  sa.Column("image_b64", sa.Text(), nullable=False, server_default=""))
    op.add_column("generated_posts",
                  sa.Column("canva_edit_url", sa.String(length=1024), nullable=False,
                            server_default=""))
    op.add_column("generated_posts",
                  sa.Column("visual_style", sa.String(length=64), nullable=False,
                            server_default=""))


def downgrade():
    op.drop_column("generated_posts", "visual_style")
    op.drop_column("generated_posts", "canva_edit_url")
    op.drop_column("generated_posts", "image_b64")
    op.drop_column("saved_drafts", "canva_edit_url")
    op.drop_column("saved_drafts", "image_b64")
