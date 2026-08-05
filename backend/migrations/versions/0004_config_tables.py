"""config tables: competitors, tracked_keywords, agent_definitions, skills, oauth_tokens
+ competitor_posts.platform

Revision ID: 0004_config_tables
Revises: 0003_generate_columns
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_config_tables"
down_revision = "0003_generate_columns"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "competitors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("platform", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("external_id", sa.String(256), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    # Partial unique index: external_id="" is the "not yet known" sentinel and may repeat;
    # only non-empty external_ids must be unique per platform.
    op.create_index(
        "uq_competitors_platform_ext", "competitors", ["platform", "external_id"],
        unique=True, postgresql_where=sa.text("external_id <> ''"),
    )
    op.create_table(
        "tracked_keywords",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("keyword", sa.String(256), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "agent_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("skill_keys", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "oauth_tokens",
        sa.Column("provider", sa.String(32), primary_key=True),
        sa.Column("access_token", sa.Text(), nullable=False, server_default=""),
        sa.Column("refresh_token", sa.Text(), nullable=False, server_default=""),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column("competitor_posts",
                  sa.Column("platform", sa.String(32), nullable=False,
                            server_default="facebook"))


def downgrade():
    op.drop_column("competitor_posts", "platform")
    op.drop_table("oauth_tokens")
    op.drop_table("skills")
    op.drop_table("agent_definitions")
    op.drop_table("tracked_keywords")
    op.drop_table("competitors")
