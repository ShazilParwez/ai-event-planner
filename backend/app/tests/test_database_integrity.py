"""Database Integrity and Migration Verification Suite.
Verifies Alembic migrations against a fresh SQLite database, raw persisted data,
cascades, restrictions, and cross-event isolation.
"""

import os
import sqlite3
from decimal import Decimal
from pathlib import Path
from alembic.config import Config
from alembic import command
import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.base import Base
from app.models.event import Event, EventType, EventStatus
from app.models.budget import BudgetCategory, BudgetItem, BudgetItemStatus
from app.services.event_service import EventService
from app.services.budget_service import BudgetService
from app.schemas.event import EventCreate, EventUpdate
from app.schemas.budget import BudgetCategoryCreate, BudgetItemCreate, BudgetItemUpdate
from fastapi import HTTPException


# Use absolute path for reliable database isolation across processes
TEST_DB_PATH = (Path(__file__).parent.parent.parent / "fresh_integrity_audit.db").resolve()
TEST_DB_URL = f"sqlite:///{TEST_DB_PATH.as_posix()}"


@pytest.fixture(scope="module")
def fresh_migrated_db():
    """Sets up a fresh SQLite database, applies Alembic migrations, and tears down."""
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()

    backend_dir = Path(__file__).parent.parent.parent
    ini_path = (backend_dir / "alembic.ini").resolve()

    # Configure Alembic with custom database URL and explicit script_location
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
    alembic_cfg.set_main_option("script_location", str((backend_dir / "alembic").resolve()))

    # Run upgrade head
    command.upgrade(alembic_cfg, "head")

    # Connect with SQLite foreign keys enabled
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    with engine.connect() as con:
        con.exec_driver_sql("PRAGMA foreign_keys = ON;")
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()

    yield session, engine

    session.close()
    engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass


def test_migration_and_raw_schema(fresh_migrated_db):
    """Verify that Alembic migrations created all expected tables and columns."""
    session, engine = fresh_migrated_db

    con = sqlite3.connect(TEST_DB_PATH)
    cur = con.cursor()

    # Verify tables
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    assert "events" in tables
    assert "budget_categories" in tables
    assert "budget_items" in tables
    assert "alembic_version" in tables

    # Verify events columns
    event_cols = [r[1] for r in cur.execute("PRAGMA table_info(events)").fetchall()]
    for expected_col in ["id", "title", "event_type", "description", "start_date", "end_date", "expected_guest_count", "target_budget", "currency", "status"]:
        assert expected_col in event_cols

    con.close()


def test_crud_and_decimal_persistence(fresh_migrated_db):
    """Verify persistence, updates, and Decimal precision at both ORM and raw SQLite levels."""
    session, engine = fresh_migrated_db

    # 1. Create Event via EventService
    event_in = EventCreate(
        title="Pooja & Dev's Heritage Wedding",
        event_type=EventType.WEDDING,
        description="Traditional ceremonies in Jaipur",
        location="Jaipur, Rajasthan",
        target_budget=Decimal("4500000.50"),
        currency="INR",
        expected_guest_count=350,
    )
    event = EventService.create_event(session, event_in)
    assert event.id is not None
    event_id = event.id

    # 2. Add Category
    cat_in = BudgetCategoryCreate(
        name="Royal Palace Venue",
        allocated_amount=Decimal("1800000.75"),
        percentage_target=Decimal("40.00"),
    )
    category = BudgetService.create_category(session, event_id, cat_in)
    cat_id = category.id

    # 3. Add Expense Item
    item_in = BudgetItemCreate(
        category_id=cat_id,
        title="Courtyard Palace Booking Advance",
        estimated_cost=Decimal("1500000.25"),
        actual_cost=Decimal("1550000.50"),
        paid_amount=Decimal("750000.25"),
        status=BudgetItemStatus.PENDING,
    )
    item = BudgetService.create_item(session, event_id, item_in)
    item_id = item.id

    # 4. Direct SQLite Query to verify raw persisted Decimal precision
    con = sqlite3.connect(TEST_DB_PATH)
    cur = con.cursor()

    raw_event = cur.execute("SELECT title, target_budget, currency, expected_guest_count FROM events WHERE id = ?", (event_id,)).fetchone()
    assert raw_event[0] == "Pooja & Dev's Heritage Wedding"
    assert Decimal(str(raw_event[1])) == Decimal("4500000.50")
    assert raw_event[2] == "INR"
    assert raw_event[3] == 350

    raw_item = cur.execute("SELECT title, estimated_cost, actual_cost, paid_amount FROM budget_items WHERE id = ?", (item_id,)).fetchone()
    assert raw_item[0] == "Courtyard Palace Booking Advance"
    assert Decimal(str(raw_item[1])) == Decimal("1500000.25")
    assert Decimal(str(raw_item[2])) == Decimal("1550000.50")
    assert Decimal(str(raw_item[3])) == Decimal("750000.25")

    con.close()


def test_category_safe_deletion_guard(fresh_migrated_db):
    """Verify that deleting a category containing items is rejected unless force=True."""
    session, engine = fresh_migrated_db

    # Create event, category, item
    event = EventService.create_event(session, EventCreate(title="Test Safety Event", event_type=EventType.OTHER))
    cat = BudgetService.create_category(session, event.id, BudgetCategoryCreate(name="Decorations"))
    BudgetService.create_item(session, event.id, BudgetItemCreate(category_id=cat.id, title="Flowers"))

    # Deleting without force must raise HTTPException 400
    with pytest.raises(HTTPException) as exc_info:
        BudgetService.delete_category(session, event.id, cat.id, force=False)
    assert exc_info.value.status_code == 400
    assert "contains" in exc_info.value.detail.lower()

    # Deleting with force=True succeeds
    BudgetService.delete_category(session, event.id, cat.id, force=True)
    assert session.query(BudgetCategory).filter(BudgetCategory.id == cat.id).first() is None


def test_cross_event_isolation(fresh_migrated_db):
    """Verify cross-event isolation: items cannot be linked to categories from another event."""
    session, engine = fresh_migrated_db

    event_a = EventService.create_event(session, EventCreate(title="Event Alpha", event_type=EventType.WEDDING))
    cat_a = BudgetService.create_category(session, event_a.id, BudgetCategoryCreate(name="Alpha Catering"))

    event_b = EventService.create_event(session, EventCreate(title="Event Beta", event_type=EventType.BIRTHDAY))

    # Attempt to add item to Event B using Event A's category
    with pytest.raises(HTTPException) as exc_info:
        BudgetService.create_item(
            session,
            event_b.id,
            BudgetItemCreate(category_id=cat_a.id, title="Cross Event Attempt"),
        )
    assert exc_info.value.status_code == 400
    assert "does not exist for event" in exc_info.value.detail.lower()


def test_event_deletion_cascade(fresh_migrated_db):
    """Verify that deleting an event cascades and deletes all associated categories and items."""
    session, engine = fresh_migrated_db

    event = EventService.create_event(session, EventCreate(title="Cascade Target Event", event_type=EventType.OTHER))
    cat = BudgetService.create_category(session, event.id, BudgetCategoryCreate(name="Cascade Cat"))
    item = BudgetService.create_item(session, event.id, BudgetItemCreate(category_id=cat.id, title="Cascade Item"))

    event_id = event.id
    cat_id = cat.id
    item_id = item.id

    # Delete Event
    EventService.delete_event(session, event_id)

    # Verify event is deleted
    assert session.query(Event).filter(Event.id == event_id).first() is None
    # Verify categories and items are cascade-deleted
    assert session.query(BudgetCategory).filter(BudgetCategory.id == cat_id).first() is None
    assert session.query(BudgetItem).filter(BudgetItem.id == item_id).first() is None
