from abc import ABC, abstractmethod
from typing import List, Optional
from decimal import Decimal
from app.models.event import EventType
from app.schemas.ai import (
    AICopilotEventGenerationRequest,
    AICopilotFullPlanResponse,
    AIBudgetPlanResponse,
    AITimelinePlanResponse,
    AICopilotChatRequest,
    AICopilotChatResponse,
    AIInspirationIdea,
)


class AIAssistantInterface(ABC):
    """Abstract interface defining required capabilities for AI copilot providers."""

    @abstractmethod
    async def generate_full_event_plan(
        self, request: AICopilotEventGenerationRequest
    ) -> AICopilotFullPlanResponse:
        """Generate complete initial event plan including budget, timeline, checklists, and ideas."""
        pass

    @abstractmethod
    async def generate_budget_breakdown(
        self, event_type: EventType, target_budget: Decimal, guest_count: int
    ) -> AIBudgetPlanResponse:
        """Generate structured category allocations and cost saving guidance."""
        pass

    @abstractmethod
    async def generate_timeline(
        self, event_type: EventType, target_date_iso: Optional[str]
    ) -> AITimelinePlanResponse:
        """Generate phased milestone schedule and day-of itinerary."""
        pass

    @abstractmethod
    async def generate_inspiration_ideas(
        self, event_type: EventType, theme: Optional[str], category: Optional[str], num_ideas: int
    ) -> List[AIInspirationIdea]:
        """Generate curated theme and activity inspiration cards."""
        pass

    @abstractmethod
    async def chat_copilot(
        self, request: AICopilotChatRequest, event_context: dict
    ) -> AICopilotChatResponse:
        """Context-aware multi-turn conversational copilot interaction."""
        pass
