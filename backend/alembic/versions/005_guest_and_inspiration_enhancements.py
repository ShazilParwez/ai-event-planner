"""guest and inspiration enhancements

Revision ID: 005_guest_and_inspiration_enhancements
Revises: 004_timeline_and_vendor_enhancements
Create Date: 2026-11-01 07:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_guest_and_inspiration_enhancements'
down_revision: Union[str, None] = '004_timeline_and_vendor_enhancements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enhance guests table
    with op.batch_alter_table('guests', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('category', sa.String(50), nullable=False, server_default='Friends')
        )
        batch_op.add_column(
            sa.Column('invitation_status', sa.String(50), nullable=False, server_default='NOT_SENT')
        )
        batch_op.add_column(
            sa.Column('accessibility_requirements', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('dietary_preferences', sa.String(255), nullable=True)
        )

    # 2. Enhance inspiration_cards table
    with op.batch_alter_table('inspiration_cards', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('color_palette', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('suggested_budget_range', sa.String(255), nullable=True)
        )
        batch_op.add_column(
            sa.Column('notes', sa.Text(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('source_type', sa.String(50), nullable=False, server_default='AI_GENERATED')
        )


def downgrade() -> None:
    with op.batch_alter_table('inspiration_cards', schema=None) as batch_op:
        batch_op.drop_column('source_type')
        batch_op.drop_column('notes')
        batch_op.drop_column('suggested_budget_range')
        batch_op.drop_column('color_palette')

    with op.batch_alter_table('guests', schema=None) as batch_op:
        batch_op.drop_column('dietary_preferences')
        batch_op.drop_column('accessibility_requirements')
        batch_op.drop_column('invitation_status')
        batch_op.drop_column('category')

