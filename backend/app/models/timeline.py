from enum import Enum
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class MilestoneStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    DELAYED = "DELAYED"


class MilestonePriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TimelineMilestone(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "timeline_milestones"

    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    phase = Column(String(100), nullable=False, default="PLANNING")  # e.g. 6_MONTHS_BEFORE, 1_MONTH_BEFORE, DAY_OF
    target_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), nullable=False, default=MilestoneStatus.PENDING.value)
    priority = Column(String(50), nullable=False, default=MilestonePriority.MEDIUM.value)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_ai_suggested = Column(Boolean, nullable=False, default=False)

    @property
    def due_date(self):
        return self.target_date

    @due_date.setter
    def due_date(self, value):
        self.target_date = value

    @property
    def is_completed(self) -> bool:
        return self.status == MilestoneStatus.COMPLETED.value

    # Relationships
    event = relationship("Event", back_populates="timeline_milestones")
    activities = relationship(
        "TimelineActivity",
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="TimelineActivity.start_time",
    )


class TimelineActivity(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "timeline_activities"

    milestone_id = Column(String(36), ForeignKey("timeline_milestones.id", ondelete="SET NULL"), nullable=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    responsible_party = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="SCHEDULED")  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    order_index = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)

    # Relationships
    milestone = relationship("TimelineMilestone", back_populates="activities")
    event = relationship("Event", back_populates="timeline_activities")
