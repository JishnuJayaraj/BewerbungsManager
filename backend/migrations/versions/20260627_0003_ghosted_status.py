"""Add GHOSTED application status.

Revision ID: 20260627_0003
Revises: 20260627_0002
Create Date: 2026-06-27

On SQLite the status column is plain TEXT (no native enum / CHECK constraint by
default), so storing "GHOSTED" needs no schema change. On Postgres the column is a
native ENUM type, so we add the value explicitly.
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260627_0003"
down_revision: str | None = "20260627_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'GHOSTED'")


def downgrade() -> None:
    # Postgres cannot drop an enum value without recreating the type; leaving the value
    # in place is harmless. No-op.
    pass
