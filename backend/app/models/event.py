from enum import Enum
from sqlalchemy import Column, String, Text, Numeric, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class EventType(str, Enum):
    WEDDING = "WEDDING"
    BIRTHDAY = "BIRTHDAY"
    COMMUNITY = "COMMUNITY"
    OTHER = "OTHER"


class EventStatus(str, Enum):
    PLANNING = "PLANNING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Event(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "events"

    title = Column(String(255), nullable=False)
    event_type = Column(String(50), nullable=False, index=True) # WEDDING, BIRTHDAY, COMMUNITY, OTHER
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    expected_guest_count = Column(Integer, nullable=False, default=0)
    target_budget = Column(Numeric(12, 2), nullable=False, default=0.00)
    currency = Column(String(10), nullable=False, default="INR")
    status = Column(String(50), nullable=False, default=EventStatus.PLANNING.value)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Backward compatibility fields
    event_date = Column(DateTime(timezone=True), nullable=True)
    theme = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    @property
    def name(self) -> str:
        return self.title

    @property
    def total_budget(self):
        return self.target_budget

    # Relationships
    owner = relationship("User", back_populates="events")
    budget_categories = relationship("BudgetCategory", back_populates="event", cascade="all, delete-orphan")
    budget_items = relationship("BudgetItem", back_populates="event", cascade="all, delete-orphan")
    timeline_milestones = relationship("TimelineMilestone", back_populates="event", cascade="all, delete-orphan")
    timeline_activities = relationship("TimelineActivity", back_populates="event", cascade="all, delete-orphan")
    vendor_items = relationship("VendorItem", back_populates="event", cascade="all, delete-orphan")
    guests = relationship("Guest", back_populates="event", cascade="all, delete-orphan")
    inspiration_cards = relationship("InspirationCard", back_populates="event", cascade="all, delete-orphan")
    copilot_threads = relationship("CopilotThread", back_populates="event", cascade="all, delete-orphan")
    copilot_messages = relationship("CopilotMessage", back_populates="event", cascade="all, delete-orphan")
    copilot_actions = relationship("CopilotAction", back_populates="event", cascade="all, delete-orphan")
    accessibility_profile = relationship("EventAccessibility", back_populates="event", uselist=False, cascade="all, delete-orphan")
