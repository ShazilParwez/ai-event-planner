"""add priority and description to timeline, and location website advance_paid to vendor_items

Revision ID: 004_timeline_and_vendor_enhancements
Revises: 003_add_inspiration_updated_at
Create Date: 2026-11-01 06:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '004_timeline_and_vendor_enhancements'
down_revision: Union[str, None] = '003_add_inspiration_updated_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Timeline Milestones Enhancements
    with op.batch_alter_table('timeline_milestones', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('priority', sa.String(50), nullable=False, server_default='MEDIUM')
        )
        batch_op.add_column(
            sa.Column('description', sa.Text(), nullable=True)
        )

    # 2. Timeline Activities Enhancements
    with op.batch_alter_table('timeline_activities', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('order_index', sa.Integer(), nullable=False, server_default='0')
        )
        batch_op.add_column(
            sa.Column('description', sa.Text(), nullable=True)
        )

    # 3. Vendor Items Enhancements
    with op.batch_alter_table('vendor_items', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('location', sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column('website', sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column('advance_paid', sa.Numeric(12, 2), nullable=False, server_default='0.00')
        )


def downgrade() -> None:
    with op.batch_alter_table('vendor_items', schema=None) as batch_op:
        batch_op.drop_column('advance_paid')
        batch_op.drop_column('website')
        batch_op.drop_column('location')

    with op.batch_alter_table('timeline_activities', schema=None) as batch_op:
        batch_op.drop_column('description')
        batch_op.drop_column('order_index')

    with op.batch_alter_table('timeline_milestones', schema=None) as batch_op:
        batch_op.drop_column('description')
        batch_op.drop_column('priority')

