"""copilot conversation persistence

Revision ID: 006_copilot_conversation_persistence
Revises: 005_guest_and_inspiration_enhancements
Create Date: 2026-11-01 07:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '006_copilot_conversation_persistence'
down_revision: Union[str, None] = '005_guest_and_inspiration_enhancements'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Copilot Threads Table
    op.create_table(
        'copilot_threads',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False, server_default='New Chat'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_copilot_threads_event_id', 'copilot_threads', ['event_id'])

    # 2. Copilot Messages Table
    op.create_table(
        'copilot_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('thread_id', sa.String(36), sa.ForeignKey('copilot_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('suggested_prompts', sa.Text(), nullable=True),
        sa.Column('warnings', sa.Text(), nullable=True),
        sa.Column('source', sa.String(50), nullable=False, server_default='gemini'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_copilot_messages_thread_id', 'copilot_messages', ['thread_id'])
    op.create_index('ix_copilot_messages_event_id', 'copilot_messages', ['event_id'])

    # 3. Copilot Actions Table
    op.create_table(
        'copilot_actions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('thread_id', sa.String(36), sa.ForeignKey('copilot_threads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parameters', sa.Text(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='PENDING'),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_copilot_actions_thread_id', 'copilot_actions', ['thread_id'])
    op.create_index('ix_copilot_actions_event_id', 'copilot_actions', ['event_id'])
    op.create_index('ix_copilot_actions_status', 'copilot_actions', ['status'])


def downgrade() -> None:
    op.drop_index('ix_copilot_actions_status', table_name='copilot_actions')
    op.drop_index('ix_copilot_actions_event_id', table_name='copilot_actions')
    op.drop_index('ix_copilot_actions_thread_id', table_name='copilot_actions')
    op.drop_table('copilot_actions')

    op.drop_index('ix_copilot_messages_event_id', table_name='copilot_messages')
    op.drop_index('ix_copilot_messages_thread_id', table_name='copilot_messages')
    op.drop_table('copilot_messages')

    op.drop_index('ix_copilot_threads_event_id', table_name='copilot_threads')
    op.drop_table('copilot_threads')

