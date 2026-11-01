"""add updated_at to inspiration_cards

Revision ID: 003_add_inspiration_updated_at
Revises: 002_add_event_fields
Create Date: 2026-11-01 05:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '003_add_inspiration_updated_at'
down_revision: Union[str, None] = '002_add_event_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('inspiration_cards', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table('inspiration_cards', schema=None) as batch_op:
        batch_op.drop_column('updated_at')

