"""Add education table and profile links.

Revision ID: 20260627_0002
Revises: 20260626_0001
Create Date: 2026-06-27
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260627_0002"
down_revision: str | None = "20260626_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    profile_columns = {column["name"] for column in inspector.get_columns("profiles")}
    tables = set(inspector.get_table_names())

    # server_default keeps existing rows valid; kept (not dropped) for SQLite compatibility.
    if "links" not in profile_columns:
        op.add_column(
            "profiles",
            sa.Column("links", sa.JSON(), nullable=False, server_default="[]"),
        )

    if "education" in tables:
        return

    op.create_table(
        "education",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("degree", sa.String(), nullable=False),
        sa.Column("institution", sa.String(), nullable=True),
        sa.Column("field_of_study", sa.String(), nullable=True),
        sa.Column("start", sa.Date(), nullable=True),
        sa.Column("end", sa.Date(), nullable=True),
        sa.Column("grade", sa.String(), nullable=True),
        sa.Column("summary", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_education_profile_id"), "education", ["profile_id"], unique=False)
    op.create_index(op.f("ix_education_user_id"), "education", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_education_user_id"), table_name="education")
    op.drop_index(op.f("ix_education_profile_id"), table_name="education")
    op.drop_table("education")
    op.drop_column("profiles", "links")
