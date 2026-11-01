from enum import Enum
from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class InspirationCategory(str, Enum):
    THEMES = "Event Themes"
    DECORATIONS = "Decorations"
    COLOR_PALETTES = "Color Palettes"
    CATERING = "Catering and Menus"
    ENTERTAINMENT = "Entertainment"
    PHOTOGRAPHY = "Photography Concepts"
    INVITATIONS = "Invitations"
    ACTIVITIES = "Activities"
    OTHER = "Other"
    # Backward compatibility aliases
    THEME = "THEME"
    DECOR = "DECOR"
    ACTIVITY = "ACTIVITY"
    FAVORS = "FAVORS"


class InspirationSource(str, Enum):
    USER = "USER"
    AI_GENERATED = "AI_GENERATED"


class InspirationCard(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "inspiration_cards"

    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    tags = Column(String(255), nullable=True)  # Comma-separated theme tags
    color_palette = Column(Text, nullable=True)  # JSON-encoded array of hex codes
    suggested_budget_range = Column(String(255), nullable=True)  # Indicative estimates
    notes = Column(Text, nullable=True)
    is_ai_generated = Column(Boolean, nullable=False, default=True)
    is_saved = Column(Boolean, nullable=False, default=True)
    source_type = Column(String(50), nullable=False, default=InspirationSource.AI_GENERATED.value)

    # Relationships
    event = relationship("Event", back_populates="inspiration_cards")
