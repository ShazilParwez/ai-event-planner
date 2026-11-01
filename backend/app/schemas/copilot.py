from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


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


class CopilotWarning(BaseModel):
    warning_type: str = Field(description="BUDGET_OVERRUN, TIMELINE_OVERDUE, DIETARY_ALERT, VENDOR_UNCOMMITTED, GENERAL")
    severity: str = Field(default="MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    message: str


class CopilotProposedAction(BaseModel):
    action_id: str = Field(description="Client-side correlation UUID or DB action ID")
    action_type: CopilotActionType
    title: str = Field(description="Concise human-readable action title")
    description: Optional[str] = Field(default=None, description="Reasoning and impact of this action")
    parameters: Dict[str, Any] = Field(description="Exact creation parameters conforming to domain schema")
    status: CopilotActionStatus = Field(default=CopilotActionStatus.PENDING)


class CopilotActionResponse(BaseModel):
    id: str
    thread_id: str
    event_id: str
    action_type: str
    title: str
    description: Optional[str] = None
    parameters: Dict[str, Any] = {}
    status: str
    executed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CopilotThreadCreate(BaseModel):
    title: Optional[str] = Field(default="New Chat", max_length=255)


class CopilotThreadResponse(BaseModel):
    id: str
    event_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CopilotMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000, description="User prompt text")


class CopilotMessageResponse(BaseModel):
    id: str
    thread_id: str
    event_id: str
    role: str
    content: str
    suggested_prompts: List[str] = []
    warnings: List[CopilotWarning] = []
    proposed_actions: List[CopilotProposedAction] = []
    source: str = "gemini"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AICopilotChatResponse(BaseModel):
    response: str = Field(description="Conversational markdown guidance")
    suggested_prompts: List[str] = Field(default=[], description="Interactive follow-up chips")
    suggested_actions: List[str] = Field(default=[], description="Backward-compatible string list of suggested actions")
    proposed_actions: List[CopilotProposedAction] = Field(default=[], description="Structured actionable mutations")
    warnings: List[CopilotWarning] = Field(default=[], description="Contextual alerts")
    source: str = Field(default="gemini", description="gemini, mock, deterministic_fallback")


class CopilotActionExecuteResponse(BaseModel):
    action_id: str
    status: str = "EXECUTED"
    action_type: str
    created_resource_id: Optional[str] = None
    details: Dict[str, Any] = {}
    message: str


class CopilotActionDismissResponse(BaseModel):
    action_id: str
    status: str = "DISMISSED"
    message: str
