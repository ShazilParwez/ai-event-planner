"""add users and event ownership

Revision ID: 007_add_users_and_event_ownership
Revises: 006_copilot_conversation_persistence
Create Date: 2026-11-01 16:30:00.000000

"""
import os
import secrets
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.core.security import get_password_hash


revision: str = '007_add_users_and_event_ownership'
down_revision: Union[str, None] = '006_copilot_conversation_persistence'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_ADMIN_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_ADMIN_EMAIL = "admin@eventplanner.com"


def get_initial_admin_hash() -> str:
    """Provisions admin password dynamically without leaving a hardcoded publicly known password."""
    admin_pw = os.environ.get("INITIAL_ADMIN_PASSWORD")
    if not admin_pw:
        admin_pw = secrets.token_urlsafe(32)
    return get_password_hash(admin_pw)


def upgrade() -> None:
    # 1. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # 2. Seed initial admin / owner user safely and idempotently
    users_table = sa.table(
        'users',
        sa.column('id', sa.String),
        sa.column('email', sa.String),
        sa.column('hashed_password', sa.String),
        sa.column('full_name', sa.String),
        sa.column('is_active', sa.Boolean),
        sa.column('is_superuser', sa.Boolean),
    )
    
    conn = op.get_bind()
    existing = conn.execute(
        sa.text(f"SELECT id FROM users WHERE id = '{DEFAULT_ADMIN_ID}' OR email = '{DEFAULT_ADMIN_EMAIL}'")
    ).fetchone()
    if not existing:
        op.bulk_insert(
            users_table,
            [
                {
                    'id': DEFAULT_ADMIN_ID,
                    'email': DEFAULT_ADMIN_EMAIL,
                    'hashed_password': get_initial_admin_hash(),
                    'full_name': 'Default Event Administrator',
                    'is_active': True,
                    'is_superuser': True,
                }
            ],
        )

    # 3. Add owner_id to events table with named foreign key constraint
    with op.batch_alter_table('events') as batch_op:
        batch_op.add_column(
            sa.Column('owner_id', sa.String(36), nullable=True)
        )
        batch_op.create_foreign_key(
            'fk_events_owner_id_users',
            'users',
            ['owner_id'],
            ['id'],
            ondelete='SET NULL'
        )
        batch_op.create_index('ix_events_owner_id', ['owner_id'])

    # 4. Backfill existing orphaned events to the default administrator user
    op.execute(
        f"UPDATE events SET owner_id = '{DEFAULT_ADMIN_ID}' WHERE owner_id IS NULL"
    )


def downgrade() -> None:
    with op.batch_alter_table('events') as batch_op:
        batch_op.drop_constraint('fk_events_owner_id_users', type_='foreignkey')
        batch_op.drop_index('ix_events_owner_id')
        batch_op.drop_column('owner_id')

    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
