from enum import Enum
from sqlalchemy import Column, String, Text, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class BudgetItemStatus(str, Enum):
    ESTIMATED = "ESTIMATED"
    PENDING = "PENDING"
    PAID = "PAID"


class BudgetCategory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "budget_categories"

    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    allocated_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    percentage_target = Column(Numeric(5, 2), nullable=False, default=0.00)

    # Relationships
    event = relationship("Event", back_populates="budget_categories")
    items = relationship("BudgetItem", back_populates="category", cascade="all, delete-orphan")


class BudgetItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "budget_items"

    category_id = Column(String(36), ForeignKey("budget_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    estimated_cost = Column(Numeric(12, 2), nullable=False, default=0.00)
    actual_cost = Column(Numeric(12, 2), nullable=False, default=0.00)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    status = Column(String(50), nullable=False, default=BudgetItemStatus.ESTIMATED.value)
    is_ai_suggested = Column(Boolean, nullable=False, default=False)
    notes = Column(Text, nullable=True)

    # Relationships
    category = relationship("BudgetCategory", back_populates="items")
    event = relationship("Event", back_populates="budget_items")
