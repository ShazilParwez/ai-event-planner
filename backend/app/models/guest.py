from enum import Enum
from sqlalchemy import Column, String, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class RSVPStatus(str, Enum):
    INVITED = "INVITED"
    CONFIRMED = "CONFIRMED"
    DECLINED = "DECLINED"
    MAYBE = "MAYBE"
    WAITING = "WAITING"
    # Backward compatibility
    PENDING = "PENDING"
    ATTENDING = "ATTENDING"


class GuestCategory(str, Enum):
    FAMILY = "Family"
    FRIENDS = "Friends"
    COLLEAGUES = "Colleagues"
    VIP = "VIP"
    COMMUNITY = "Community"
    OTHER = "Other"


class InvitationStatus(str, Enum):
    NOT_SENT = "NOT_SENT"
    SENT = "SENT"


class Guest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "guests"

    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    category = Column(String(50), nullable=False, default=GuestCategory.FRIENDS.value)
    rsvp_status = Column(String(50), nullable=False, default=RSVPStatus.INVITED.value)
    invitation_status = Column(String(50), nullable=False, default=InvitationStatus.NOT_SENT.value)
    plus_ones = Column(Integer, nullable=False, default=0)
    dietary_preferences = Column(String(255), nullable=True)
    dietary_restrictions = Column(String(255), nullable=True)
    accessibility_requirements = Column(Text, nullable=True)
    table_assignment = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    event = relationship("Event", back_populates="guests")
