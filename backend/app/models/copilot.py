from enum import Enum
import json
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class CopilotRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class CopilotActionType(str, Enum):
    ADD_TIMELINE_MILESTONE = "ADD_TIMELINE_MILESTONE"
    ADD_BUDGET_EXPENSE = "ADD_BUDGET_EXPENSE"
    ADD_VENDOR_ITEM = "ADD_VENDOR_ITEM"


class CopilotActionStatus(str, Enum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    DISMISSED = "DISMISSED"
    FAILED = "FAILED"


class CopilotThread(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "copilot_threads"

    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New Chat")

    # Relationships
    event = relationship("Event", back_populates="copilot_threads")
    messages = relationship(
        "CopilotMessage",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CopilotMessage.created_at",
    )
    actions = relationship(
        "CopilotAction",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CopilotAction.created_at",
    )


class CopilotMessage(Base, UUIDMixin):
    __tablename__ = "copilot_messages"

    thread_id = Column(String(36), ForeignKey("copilot_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    suggested_prompts = Column(Text, nullable=True)  # JSON-encoded List[str]
    warnings = Column(Text, nullable=True)  # JSON-encoded List[Dict]
    source = Column(String(50), nullable=False, default="gemini")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    thread = relationship("CopilotThread", back_populates="messages")
    event = relationship("Event", back_populates="copilot_messages")

    @property
    def parsed_suggested_prompts(self):
        if not self.suggested_prompts:
            return []
        try:
            return json.loads(self.suggested_prompts)
        except Exception:
            return []

    @property
    def parsed_warnings(self):
        if not self.warnings:
            return []
        try:
            return json.loads(self.warnings)
        except Exception:
            return []


class CopilotAction(Base, UUIDMixin):
    __tablename__ = "copilot_actions"

    thread_id = Column(String(36), ForeignKey("copilot_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id = Column(String(36), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    parameters = Column(Text, nullable=False)  # JSON-encoded Dict[str, Any]
    status = Column(String(50), nullable=False, default=CopilotActionStatus.PENDING.value)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    thread = relationship("CopilotThread", back_populates="actions")
    event = relationship("Event", back_populates="copilot_actions")

    @property
    def parsed_parameters(self):
        if not self.parameters:
            return {}
        try:
            return json.loads(self.parameters)
        except Exception:
            return {}

