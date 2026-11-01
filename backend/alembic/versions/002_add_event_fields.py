"""add event fields for Phase 2

Revision ID: 002_add_event_fields
Revises: 001_initial_schema
Create Date: 2026-10-31 08:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_add_event_fields'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add description, start_date, end_date, expected_guest_count to events
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('end_date', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('expected_guest_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_column('expected_guest_count')
        batch_op.drop_column('end_date')
        batch_op.drop_column('start_date')
        batch_op.drop_column('description')

