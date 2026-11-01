import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class UUIDMixin:
    """Mixin for UUID primary key stored as 36-char string for universal DB support."""
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)


class TimestampMixin:
    """Mixin for standardized UTC audit timestamps."""
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
