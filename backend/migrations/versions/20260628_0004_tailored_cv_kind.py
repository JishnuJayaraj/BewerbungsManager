"""Add TAILORED_CV artifact kind.

Revision ID: 20260628_0004
Revises: 20260627_0003
Create Date: 2026-06-28

SQLite stores the enum as TEXT (no constraint), so no schema change is needed there.
On Postgres the kind is a native ENUM, so we add the value explicitly.
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260628_0004"
down_revision: str | None = "20260627_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE artifactkind ADD VALUE IF NOT EXISTS 'TAILORED_CV'")


def downgrade() -> None:
    pass
