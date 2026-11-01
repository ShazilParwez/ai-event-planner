from typing import List, Optional, Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.event import EventType


class AICategoryAllocation(BaseModel):
    category_name: str
    percentage: Decimal = Field(ge=0, le=100)
    suggested_amount: Decimal = Field(ge=0)
    rationale: str
    recommended_items: List[str] = []


class AIBudgetPlanResponse(BaseModel):
    event_type: EventType
    total_budget: Decimal
    currency: str = "INR"
    allocations: List[AICategoryAllocation]
    cost_saving_tips: List[str]
    disclaimer: str = "Estimates are directional guidelines. Final prices depend on actual vendor quotes and local market rates."


class AIMilestonePlan(BaseModel):
    title: str
    phase: str
    recommended_timeline: str # e.g. "9-12 Months Before"
    key_tasks: List[str]


class AITimelinePlanResponse(BaseModel):
    event_type: EventType
    milestones: List[AIMilestonePlan]
    day_of_schedule_sample: List[Dict[str, str]]


class AIVendorChecklistRecommendation(BaseModel):
    category: str
    recommended_checklist: List[str]
    questions_to_ask_vendor: List[str]
    booking_urgency: str # HIGH, MEDIUM, LOW


class AIInspirationIdea(BaseModel):
    title: str
    category: str
    description: str
    tags: List[str] = []
    color_palette: List[str] = []
    suggested_budget_range: Optional[str] = None


class AIInspirationIdeasWrapper(BaseModel):
    ideas: List[AIInspirationIdea]


class AICopilotEventGenerationRequest(BaseModel):
    title: str
    event_type: EventType
    target_budget: Decimal
    guest_count: int = 50
    location: Optional[str] = None
    theme: Optional[str] = None
    notes: Optional[str] = None


class AICopilotFullPlanResponse(BaseModel):
    summary: str
    theme_recommendation: str
    budget_breakdown: AIBudgetPlanResponse
    timeline_plan: AITimelinePlanResponse
    vendor_checklists: List[AIVendorChecklistRecommendation]
    inspiration_ideas: List[AIInspirationIdea]
    source: str = "gemini" # "gemini" or "deterministic_fallback" or "mock"


class AICopilotMessage(BaseModel):
    role: str # "user", "assistant", "system"
    content: str


class AICopilotChatRequest(BaseModel):
    event_id: str
    message: str
    conversation_history: List[AICopilotMessage] = []


from app.schemas.copilot import (
    CopilotActionType,
    CopilotActionStatus,
    CopilotWarning,
    CopilotProposedAction,
    AICopilotChatResponse,
)
