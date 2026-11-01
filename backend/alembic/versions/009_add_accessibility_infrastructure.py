"""add event accessibility infrastructure

Revision ID: 009_add_accessibility_infrastructure
Revises: 008_add_refresh_token_revocation
Create Date: 2026-11-01 21:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '009_add_accessibility_infrastructure'
down_revision: Union[str, None] = '008_add_refresh_token_revocation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_accessibility',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('profile_data', sa.JSON(), nullable=False),
        sa.Column('venue_facilities', sa.JSON(), nullable=False),
        sa.Column('venue_routes', sa.JSON(), nullable=False),
        sa.Column('emergency_support', sa.JSON(), nullable=False),
        sa.Column('generated_plan', sa.JSON(), nullable=True),
        sa.Column('plan_generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('coverage_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('confidence_level', sa.String(20), nullable=False, server_default='LOW'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_event_accessibility_event_id', 'event_accessibility', ['event_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_event_accessibility_event_id', table_name='event_accessibility')
    op.drop_table('event_accessibility')

