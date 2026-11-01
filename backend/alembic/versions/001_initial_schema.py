"""Initial database schema for AI Event Planner

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-31 06:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Events Table
    op.create_table(
        'events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False), # WEDDING, BIRTHDAY, COMMUNITY
        sa.Column('event_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('theme', sa.String(255), nullable=True),
        sa.Column('target_budget', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='INR'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='PLANNING'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_events_event_type', 'events', ['event_type'])

    # 2. Budget Categories Table
    op.create_table(
        'budget_categories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('allocated_amount', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('percentage_target', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_budget_categories_event_id', 'budget_categories', ['event_id'])

    # 3. Budget Items Table (Deterministic calculation unit)
    op.create_table(
        'budget_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('category_id', sa.String(36), sa.ForeignKey('budget_categories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('estimated_cost', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('actual_cost', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('paid_amount', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('status', sa.String(50), nullable=False, server_default='ESTIMATED'), # ESTIMATED, PENDING, PAID
        sa.Column('is_ai_suggested', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_budget_items_event_id', 'budget_items', ['event_id'])
    op.create_index('ix_budget_items_category_id', 'budget_items', ['category_id'])

    # 4. Timeline Milestones Table
    op.create_table(
        'timeline_milestones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('phase', sa.String(100), nullable=False), # e.g. 6_MONTHS_BEFORE, 1_MONTH_BEFORE, DAY_OF
        sa.Column('target_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='PENDING'), # PENDING, IN_PROGRESS, COMPLETED
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_ai_suggested', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_timeline_milestones_event_id', 'timeline_milestones', ['event_id'])

    # 5. Timeline Activities Table (Day-of minute-by-minute schedule)
    op.create_table(
        'timeline_activities',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('milestone_id', sa.String(36), sa.ForeignKey('timeline_milestones.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('responsible_party', sa.String(255), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='SCHEDULED'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_timeline_activities_event_id', 'timeline_activities', ['event_id'])

    # 6. Vendor Categories Table
    op.create_table(
        'vendor_categories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('description', sa.String(255), nullable=True),
    )

    # 7. Vendor Checklist Items Table
    op.create_table(
        'vendor_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(100), nullable=False), # Catering, Venue, Photography, etc.
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('contact_name', sa.String(255), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('contact_phone', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='TODO'), # TODO, RESEARCHING, CONTACTED, HIRED, REJECTED
        sa.Column('estimated_quote', sa.Numeric(12, 2), nullable=True),
        sa.Column('final_agreed_price', sa.Numeric(12, 2), nullable=True),
        sa.Column('contract_signed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_ai_suggested_checklist', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_vendor_items_event_id', 'vendor_items', ['event_id'])

    # 8. Guest Management Table
    op.create_table(
        'guests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('rsvp_status', sa.String(50), nullable=False, server_default='PENDING'), # PENDING, ATTENDING, DECLINED
        sa.Column('plus_ones', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('dietary_restrictions', sa.String(255), nullable=True),
        sa.Column('table_assignment', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_guests_event_id', 'guests', ['event_id'])

    # 9. Inspiration Studio Ideas Table
    op.create_table(
        'inspiration_cards',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('event_id', sa.String(36), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('category', sa.String(100), nullable=False), # THEME, DECOR, ACTIVITY, FAVORS
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('tags', sa.String(255), nullable=True), # Comma-separated tags
        sa.Column('is_ai_generated', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_saved', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_inspiration_cards_event_id', 'inspiration_cards', ['event_id'])


def downgrade() -> None:
    op.drop_table('inspiration_cards')
    op.drop_table('guests')
    op.drop_table('vendor_items')
    op.drop_table('vendor_categories')
    op.drop_table('timeline_activities')
    op.drop_table('timeline_milestones')
    op.drop_table('budget_items')
    op.drop_table('budget_categories')
    op.drop_table('events')
