"""add refresh token revocation and token version

Revision ID: 008_add_refresh_token_revocation
Revises: 007_add_users_and_event_ownership
Create Date: 2026-11-01 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '008_add_refresh_token_revocation'
down_revision: Union[str, None] = '007_add_users_and_event_ownership'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add token_version to users table for session invalidation on password change
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column('token_version', sa.Integer(), nullable=False, server_default='1')
        )

    # 2. Create refresh_tokens table for rotation, revocation, and reuse detection
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('token_jti', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('replaced_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_refresh_tokens_token_jti', 'refresh_tokens', ['token_jti'], unique=True)
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_refresh_tokens_user_id', table_name='refresh_tokens')
    op.drop_index('ix_refresh_tokens_token_jti', table_name='refresh_tokens')
    op.drop_table('refresh_tokens')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('token_version')

