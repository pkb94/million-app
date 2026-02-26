"""0012 — add role column to users table

Revision ID: 0012
Revises: 0011_cash_ledger_foundation
Create Date: 2026-02-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011_cash_ledger_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column(
                "role",
                sa.String,
                nullable=False,
                server_default="user",
            )
        )
        batch_op.add_column(
            sa.Column(
                "is_active",
                sa.Boolean,
                nullable=False,
                server_default="1",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("role")
        batch_op.drop_column("is_active")
