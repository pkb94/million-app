"""Add card_name to credit_card_weeks table

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("credit_card_weeks", sa.Column("card_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("credit_card_weeks", "card_name")
