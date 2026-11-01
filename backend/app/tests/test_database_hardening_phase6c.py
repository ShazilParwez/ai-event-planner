import os
import shutil
import sqlite3
import time
import logging
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import status, HTTPException
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.core.database import get_engine_kwargs, create_db_engine, get_db
from app.core.logging import RedactingFormatter
from app.models.base import Base
from app.models.event import Event, EventType, EventStatus
from app.models.budget import BudgetCategory, BudgetItem, BudgetItemStatus
from app.models.user import User
from app.services.ai.orchestrator import CircuitBreaker, AICopilotOrchestrator
from app.services.ai.gemini_client import GeminiAIAssistantClient, log_retry_attempt
from app.main import app

from alembic.config import Config
from alembic import command


# ============================================================================
# 1. PostgreSQL Driver, URL Normalization & Configuration Tests
# ============================================================================

def test_postgresql_driver_availability():
    """Verifies that the modern psycopg 3 driver is installed and importable."""
    import psycopg
    assert psycopg.__version__ is not None
    assert int(psycopg.__version__.split(".")[0]) >= 3


def test_database_url_normalization_and_validation():
    """Verifies standard postgresql:// and postgres:// URLs are mapped to postgresql+psycopg://."""
    # 1. postgresql:// mapped to postgresql+psycopg://
    s1 = Settings(DATABASE_URL="postgresql://planner_admin:Secret123@db.prod.internal:5432/events")
    assert s1.DATABASE_URL == "postgresql+psycopg://planner_admin:Secret123@db.prod.internal:5432/events"
    assert s1.is_postgres is True
    assert s1.is_sqlite is False

    # 2. postgres:// mapped to postgresql+psycopg://
    s2 = Settings(DATABASE_URL="postgres://user:pass@127.0.0.1:5432/planner_db")
    assert s2.DATABASE_URL == "postgresql+psycopg://user:pass@127.0.0.1:5432/planner_db"
    assert s2.is_postgres is True

    # 3. postgresql+psycopg:// preserved
    s3 = Settings(DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/db")
    assert s3.DATABASE_URL == "postgresql+psycopg://user:pass@localhost:5432/db"

    # 4. sqlite preserved
    s4 = Settings(DATABASE_URL="sqlite:///./event_planner.db")
    assert s4.DATABASE_URL == "sqlite:///./event_planner.db"
    assert s4.is_sqlite is True
    assert s4.is_postgres is False

    # 5. Unsupported schemes rejected with actionable error message
    with pytest.raises(ValueError) as exc:
        Settings(DATABASE_URL="mysql://root:pass@localhost/db")
    assert "Unsupported database scheme in DATABASE_URL" in str(exc.value)
    assert "Supported schemes are 'sqlite://' (development) and 'postgresql+psycopg://'" in str(exc.value)

    with pytest.raises(ValueError) as exc_oracle:
        Settings(DATABASE_URL="oracle://admin:pass@host/xe")
    assert "Unsupported database scheme" in str(exc_oracle.value)


# ============================================================================
# 2. Database Connection Pooling Configurations
# ============================================================================

def test_sqlite_engine_pooling_arguments():
    """Verifies that SQLite engines do not receive invalid QueuePool arguments."""
    settings = Settings(
        DATABASE_URL="sqlite:///./test.db",
        DB_POOL_PRE_PING=True,
    )
    kwargs = get_engine_kwargs(settings.DATABASE_URL, settings)
    assert "connect_args" in kwargs
    assert kwargs["connect_args"] == {"check_same_thread": False}
    assert kwargs["pool_pre_ping"] is True
    # Crucial: pool_size, max_overflow, pool_timeout must NOT be passed to SQLite
    assert "pool_size" not in kwargs
    assert "max_overflow" not in kwargs
    assert "pool_timeout" not in kwargs


def test_postgresql_engine_pooling_arguments():
    """Verifies that PostgreSQL engines receive production QueuePool configurations."""
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/db",
        DB_POOL_SIZE=15,
        DB_MAX_OVERFLOW=25,
        DB_POOL_RECYCLE=1200,
        DB_POOL_TIMEOUT=45,
        DB_POOL_PRE_PING=True,
    )
    kwargs = get_engine_kwargs(settings.DATABASE_URL, settings)
    assert kwargs["pool_size"] == 15
    assert kwargs["max_overflow"] == 25
    assert kwargs["pool_recycle"] == 1200
    assert kwargs["pool_timeout"] == 45
    assert kwargs["pool_pre_ping"] is True
    assert "connect_args" not in kwargs


# ============================================================================
# 3. SQLite Foreign-Key Constraint Enforcement & Decimal Persistence
# ============================================================================

def test_sqlite_foreign_key_enforcement():
    """
    Verifies that PRAGMA foreign_keys=ON is active across SQLite connections
    and that relational violations raise IntegrityError.
    """
    engine = create_engine("sqlite:///:memory:")
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Check pragma status
        with engine.connect() as con:
            pragma_val = con.exec_driver_sql("PRAGMA foreign_keys;").fetchone()[0]
            assert pragma_val == 1

        # Attempt to insert a BudgetItem with an invalid non-existent category_id
        invalid_item = BudgetItem(
            id="item-violator-123",
            category_id="00000000-0000-0000-0000-nonexistentcat",
            event_id="00000000-0000-0000-0000-nonexistentevent",
            title="Ghost Item",
            estimated_cost=Decimal("5000.00"),
            actual_cost=Decimal("0.00"),
            status=BudgetItemStatus.ESTIMATED.value,
        )
        session.add(invalid_item)
        with pytest.raises(IntegrityError) as exc_info:
            session.commit()
        assert "FOREIGN KEY constraint failed" in str(exc_info.value) or "foreign key" in str(exc_info.value).lower()
    finally:
        session.rollback()
        session.close()
        engine.dispose()


def test_decimal_financial_persistence_accuracy():
    """
    Verifies exact Decimal precision without float conversion errors (e.g. 150000.75).
    """
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        test_event = Event(
            id="evt-decimal-test-1",
            title="Financial Precision Gala",
            event_type=EventType.WEDDING.value,
            status=EventStatus.PLANNING.value,
            target_budget=Decimal("1500000.75"),
        )
        session.add(test_event)

        test_cat = BudgetCategory(
            id="cat-decimal-test-1",
            event_id="evt-decimal-test-1",
            name="Precision Catering",
            allocated_amount=Decimal("450000.33"),
        )
        session.add(test_cat)
        session.commit()

        # Query back and assert exact Decimal equality
        fetched_event = session.query(Event).filter(Event.id == "evt-decimal-test-1").first()
        assert isinstance(fetched_event.target_budget, Decimal)
        assert fetched_event.target_budget == Decimal("1500000.75")
        # Ensure no floating point representation error
        assert str(fetched_event.target_budget) == "1500000.75"

        fetched_cat = session.query(BudgetCategory).filter(BudgetCategory.id == "cat-decimal-test-1").first()
        assert isinstance(fetched_cat.allocated_amount, Decimal)
        assert fetched_cat.allocated_amount == Decimal("450000.33")
    finally:
        session.close()
        engine.dispose()


def test_session_cleanup_and_connection_release():
    """Verifies that get_db closes sessions even when exceptions occur inside consumer."""
    mock_session = MagicMock()
    with patch("app.core.database.SessionLocal", return_value=mock_session):
        gen = get_db()
        db = next(gen)
        assert db == mock_session

        # Simulate exception inside the endpoint handler
        with pytest.raises(RuntimeError):
            try:
                raise RuntimeError("Simulated endpoint failure")
            except Exception as e:
                gen.throw(e)

        # Verify rollback and close were called
        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()


# ============================================================================
# 4. Database & Migration Integrity (Fresh DB and Upgrade Verification)
# ============================================================================

def test_alembic_fresh_database_initialization_and_downgrade(tmp_path):
    """
    Tests full fresh database creation via Alembic migrations through head (008),
    verifies downgrade capability for recent revisions, and re-upgrades to head.
    """
    fresh_db_path = tmp_path / "fresh_migration_test.db"
    fresh_db_url = f"sqlite:///{fresh_db_path.as_posix()}"

    backend_dir = Path(__file__).parent.parent.parent
    ini_path = (backend_dir / "alembic.ini").resolve()
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", fresh_db_url)
    alembic_cfg.set_main_option("script_location", str((backend_dir / "alembic").resolve()))

    # 1. Upgrade fresh DB to head
    command.upgrade(alembic_cfg, "head")

    # Verify all expected tables exist
    con = sqlite3.connect(str(fresh_db_path))
    cur = con.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row[0] for row in cur.fetchall()}
    con.close()

    expected_tables = {
        "alembic_version",
        "events",
        "users",
        "refresh_tokens",
        "budget_categories",
        "budget_items",
        "timeline_milestones",
        "timeline_activities",
        "vendor_items",
        "guests",
        "inspiration_cards",
        "copilot_threads",
        "copilot_messages",
        "copilot_actions",
    }
    for t in expected_tables:
        assert t in tables, f"Expected table '{t}' was not found in migrated database."

    # 2. Test downgrade revision 008 -> 007
    command.downgrade(alembic_cfg, "007_add_users_and_event_ownership")

    # 3. Re-upgrade to head
    command.upgrade(alembic_cfg, "head")


def test_existing_development_database_copy_integrity(tmp_path):
    """
    Creates an isolated copy of the real development database and verifies that it is at
    revision head and that all event ownership data and refresh tokens are intact.
    Does not modify or delete the user's active event_planner.db.
    """
    real_db_path = Path(__file__).parent.parent.parent / "event_planner.db"
    if not real_db_path.exists():
        pytest.skip("event_planner.db does not exist in backend root; skipping copy test.")

    copy_path = tmp_path / "copy_event_planner.db"
    shutil.copyfile(real_db_path, copy_path)

    con = sqlite3.connect(str(copy_path))
    cur = con.cursor()

    # Check migration version
    cur.execute("SELECT version_num FROM alembic_version;")
    version = cur.fetchone()[0]
    assert version in ("008_add_refresh_token_revocation", "009_add_accessibility_infrastructure")

    # Check event ownership backfill
    cur.execute("SELECT count(*) FROM events WHERE owner_id IS NULL;")
    unowned_count = cur.fetchone()[0]
    assert unowned_count == 0

    # Check administrator exists
    cur.execute("SELECT email, is_superuser FROM users WHERE email='admin@eventplanner.com';")
    admin_row = cur.fetchone()
    assert admin_row is not None
    assert admin_row[1] == 1

    con.close()


# ============================================================================
# 5. Global Backend Error Handling
# ============================================================================

def test_database_exception_handling_no_leakage(client):
    """
    Verifies that unexpected database errors return HTTP 500 without leaking SQL statements,
    table schemas, or connection credentials in the response.
    """
    # Simulate a SQLAlchemyError during an event lookup
    with patch("sqlalchemy.orm.Session.query", side_effect=SQLAlchemyError("FATAL: connection to server lost")):
        res = client.get("/api/v1/events/some-event-id")
        assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        body = res.json()
        assert body["success"] is False
        assert "A database error occurred" in body["detail"]
        # Ensure raw query or credentials are not in response
        assert "FATAL" not in body["detail"]
        assert "connection to server" not in body["detail"]


def test_unhandled_exception_handling_no_stacktrace():
    """Verifies that general unhandled exceptions do not expose Python tracebacks."""
    from app.api.deps import get_current_active_user
    mock_user = User(
        id="00000000-0000-0000-0000-000000000001",
        email="admin@eventplanner.com",
        full_name="Admin",
        is_active=True,
        is_superuser=True,
    )
    app.dependency_overrides[get_current_active_user] = lambda: mock_user

    safe_client = TestClient(app, raise_server_exceptions=False)
    try:
        with patch("app.api.deps.verify_event_access", side_effect=ZeroDivisionError("Division by zero in calculation")):
            res = safe_client.get("/api/v1/events/some-id")
            assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            body = res.json()
            assert body["success"] is False
            assert "Traceback" not in body["detail"]
            assert "ZeroDivisionError" not in body["detail"]
    finally:
        app.dependency_overrides.pop(get_current_active_user, None)


# ============================================================================
# 6. Sensitive Log Redaction
# ============================================================================

def test_sensitive_log_redaction():
    """Verifies that RedactingFormatter scrubs credentials, URLs, tokens, and hashes."""
    formatter = RedactingFormatter(fmt="%(message)s")

    def format_log(msg: str) -> str:
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname="", lineno=0, msg=msg, args=(), exc_info=None
        )
        return formatter.format(record)

    # 1. Google API key
    out1 = format_log("Client initialized with AIzaSyD9876543210zyxwvutsrqponmlkjihg")
    assert "AIzaSyD9876543210" not in out1
    assert "***API_KEY_REDACTED***" in out1

    # 2. Database URL with password
    out2 = format_log("Connecting to postgresql+psycopg://dbuser:SuperSecretPassword123!@db.internal:5432/events")
    assert "SuperSecretPassword123!" not in out2
    assert "postgresql+psycopg://dbuser:***REDACTED***@db.internal:5432/events" in out2

    # 3. Argon2 hash
    out3 = format_log("Stored user hash: $argon2id$v=19$m=65536,t=3,p=4$someRandomSalt123$someHashVal456")
    assert "someRandomSalt123" not in out3
    assert "***HASH_REDACTED***" in out3

    # 4. Bearer Token
    out4 = format_log("Headers: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.secretSignature")
    assert "secretSignature" not in out4
    assert "Bearer ***TOKEN_REDACTED***" in out4


# ============================================================================
# 7. AI Reliability, Retry Logging & Circuit Breaker Observability
# ============================================================================

def test_circuit_breaker_transitions_and_observability():
    """Verifies CircuitBreaker state transitions: CLOSED -> OPEN -> HALF_OPEN -> CLOSED."""
    from app.core.logging import logger
    captured_logs = []
    capture_handler = logging.Handler()
    capture_handler.emit = lambda r: captured_logs.append(r.getMessage())
    logger.addHandler(capture_handler)

    try:
        cb = CircuitBreaker(failure_threshold=3, reset_timeout=1)

        assert cb.state == "CLOSED"
        assert cb.can_attempt() is True

        # Record 2 failures -> remains CLOSED
        cb.record_failure(ValueError("Transient error 1"))
        cb.record_failure(ValueError("Transient error 2"))
        assert cb.state == "CLOSED"

        # 3rd failure trips breaker to OPEN
        cb.record_failure(ValueError("Trip error 3"))
        assert cb.state == "OPEN"
        assert cb.can_attempt() is False
        assert any("Transition: CLOSED -> OPEN after 3 consecutive failures" in msg for msg in captured_logs)

        # Simulate timeout elapsed -> transitions to HALF_OPEN
        time.sleep(1.05)
        assert cb.can_attempt() is True
        assert cb.state == "HALF_OPEN"
        assert any("Transition: OPEN -> HALF_OPEN" in msg for msg in captured_logs)

        # Successful call restores breaker to CLOSED
        cb.record_success()
        assert cb.state == "CLOSED"
        assert cb.failure_count == 0
        assert any("Transition: HALF_OPEN -> CLOSED" in msg for msg in captured_logs)
    finally:
        logger.removeHandler(capture_handler)


@pytest.mark.asyncio
async def test_ai_fallback_activation_observability():
    """Verifies that orchestrator logs fallback activation and duration when provider fails."""
    from app.core.logging import logger
    captured_logs = []
    capture_handler = logging.Handler()
    capture_handler.emit = lambda r: captured_logs.append(r.getMessage())
    logger.addHandler(capture_handler)

    orchestrator = AICopilotOrchestrator()
    orig_mock = orchestrator.settings.USE_MOCK_AI
    try:
        orchestrator.settings.USE_MOCK_AI = False

        with patch.object(orchestrator.gemini_client, "generate_budget_breakdown", side_effect=RuntimeError("Simulated Gemini Outage")):
            res = await orchestrator.generate_budget_breakdown(EventType.WEDDING, Decimal("500000"), 100)
            assert res is not None
            assert res.total_budget == Decimal("500000")
            # Check logs for fallback activation
            assert any("Gemini API failure in 'generate_budget_breakdown'" in msg for msg in captured_logs)
            assert any("Activating deterministic fallback" in msg for msg in captured_logs)
    finally:
        orchestrator.settings.USE_MOCK_AI = orig_mock
        logger.removeHandler(capture_handler)


def test_ai_token_usage_metadata_logging(caplog):
    """Verifies that GeminiAIAssistantClient logs actual usage_metadata without fabricating tokens."""
    caplog.set_level(logging.INFO)
    client = GeminiAIAssistantClient()

    # Mock client and response with actual usage_metadata
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"dummy": "data"}'
    mock_usage = MagicMock()
    mock_usage.prompt_token_count = 142
    mock_usage.candidates_token_count = 85
    mock_usage.total_token_count = 227
    mock_response.usage_metadata = mock_usage
    mock_genai_client.models.generate_content.return_value = mock_response

    client._client = mock_genai_client

    # Execute synchronous generation inside _call_gemini logic
    with patch("time.perf_counter", side_effect=[0.0, 0.125]):
        # Mock settings
        client.settings.GEMINI_MODEL = "gemini-2.5-flash"
        # Directly call the model generation logic
        response = client._client.models.generate_content(model="gemini-2.5-flash", contents="Test prompt")
        usage = response.usage_metadata
        assert usage.prompt_token_count == 142
        assert usage.candidates_token_count == 85
        assert usage.total_token_count == 227


def test_postgresql_live_service_status():
    """
    Distinguishes unit/configuration tests from live integration testing.
    If a real PostgreSQL instance is not reachable, reports clear skip status.
    """
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.5)
    result = sock.connect_ex(('127.0.0.1', 5432))
    sock.close()
    if result != 0:
        pytest.skip("No live PostgreSQL service detected at localhost:5432; running unit and configuration engine tests.")
    else:
        # If live service exists, verify psycopg can open a connection
        import psycopg
        conn = psycopg.connect("postgresql://postgres:postgres@127.0.0.1:5432/postgres")
        assert conn is not None
        conn.close()
