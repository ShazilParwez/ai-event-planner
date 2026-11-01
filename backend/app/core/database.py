from typing import Generator, Dict, Any
from sqlalchemy import create_engine, event, Engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import get_settings, Settings
from app.core.logging import logger
from app.models.base import Base

settings = get_settings()


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Enforces relational integrity on every SQLite connection.
    By default, SQLite disables FOREIGN KEY enforcement. Setting PRAGMA foreign_keys=ON
    guarantees cascade deletes and child reference restrictions in development.
    """
    try:
        module_name = getattr(dbapi_connection.__class__, "__module__", "")
        if "sqlite" in module_name.lower():
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    except Exception as exc:
        logger.warning(f"Could not enforce SQLite foreign_keys PRAGMA: {exc}")


def get_engine_kwargs(url: str, app_settings: Settings) -> Dict[str, Any]:
    """
    Constructs dialect-appropriate connection arguments and pooling configurations.
    - SQLite: avoids QueuePool size/overflow options (unsupported by NullPool/StaticPool).
    - PostgreSQL: configures production QueuePool (size: 10, overflow: 20, recycle: 1800s, pre-ping: True).
    """
    kwargs: Dict[str, Any] = {
        "pool_pre_ping": app_settings.DB_POOL_PRE_PING,
        "echo": (app_settings.ENVIRONMENT == "development" and app_settings.LOG_LEVEL == "DEBUG"),
    }

    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # Production PostgreSQL pooling configurations
        kwargs["pool_size"] = app_settings.DB_POOL_SIZE
        kwargs["max_overflow"] = app_settings.DB_MAX_OVERFLOW
        kwargs["pool_recycle"] = app_settings.DB_POOL_RECYCLE
        kwargs["pool_timeout"] = app_settings.DB_POOL_TIMEOUT

    return kwargs


def create_db_engine(url: str, app_settings: Settings) -> Engine:
    """Factory creating an engine with verified pooling and dialect settings."""
    kwargs = get_engine_kwargs(url, app_settings)
    return create_engine(url, **kwargs)


engine = create_db_engine(settings.DATABASE_URL, settings)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI Dependency that yields a SQLAlchemy database session.
    Guarantees transaction rollback on error and proper connection release.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as exc:
        db.rollback()
        logger.error(f"Database session transaction error: {str(exc)}")
        raise
    finally:
        db.close()
