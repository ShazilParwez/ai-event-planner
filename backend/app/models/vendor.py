from decimal import Decimal
from enum import Enum
from sqlalchemy import Column, String, Text, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class VendorStatus(str, Enum):
    DISCOVERING = "DISCOVERING"
    CONTACTED = "CONTACTED"
    QUOTED = "QUOTED"
    NEGOTIATING = "NEGOTIATING"
    BOOKED = "BOOKED"
    CANCELLED = "CANCELLED"
    # Legacy compatibility aliases
    TODO = "DISCOVERING"
    RESEARCHING = "DISCOVERING"
    HIRED = "BOOKED"
    REJECTED = "CANCELLED"


class VendorCategory(Base, UUIDMixin):
    __tablename__ = "vendor_categories"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)


class VendorItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "vendor_items"

    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)  # Venue, Catering, Decoration, etc.
    name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default=VendorStatus.DISCOVERING.value)
    estimated_quote = Column(Numeric(12, 2), nullable=True)
    final_agreed_price = Column(Numeric(12, 2), nullable=True)
    advance_paid = Column(Numeric(12, 2), nullable=False, default=0.00)
    contract_signed = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True)
    is_ai_suggested_checklist = Column(Boolean, nullable=False, default=False)

    @property
    def quoted_amount(self) -> Decimal:
        return self.estimated_quote or Decimal("0.00")

    @property
    def agreed_cost(self) -> Decimal:
        return self.final_agreed_price or Decimal("0.00")

    @property
    def remaining_payment(self) -> Decimal:
        base = self.final_agreed_price if self.final_agreed_price is not None else (self.estimated_quote or Decimal("0.00"))
        paid = self.advance_paid or Decimal("0.00")
        diff = base - paid
        return max(Decimal("0.00"), diff)

    # Relationships
    event = relationship("Event", back_populates="vendor_items")
