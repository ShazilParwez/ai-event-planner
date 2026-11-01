from decimal import Decimal
from typing import List, Optional
from app.models.event import EventType
from app.schemas.ai import (
    AICopilotEventGenerationRequest,
    AICopilotFullPlanResponse,
    AIBudgetPlanResponse,
    AICategoryAllocation,
    AITimelinePlanResponse,
    AIMilestonePlan,
    AIVendorChecklistRecommendation,
    AIInspirationIdea,
    AICopilotChatRequest,
    AICopilotChatResponse,
)
from app.services.ai.interface import AIAssistantInterface
from app.services.ai.fallback import (
    generate_fallback_budget,
    generate_fallback_timeline,
    generate_fallback_vendor_checklists,
    generate_fallback_inspiration,
    generate_fallback_full_plan,
    generate_fallback_chat_reply,
)


class MockAIAssistantClient(AIAssistantInterface):
    """Deterministic Mock AI client for automated testing and offline development."""

    async def generate_full_event_plan(
        self, request: AICopilotEventGenerationRequest
    ) -> AICopilotFullPlanResponse:
        plan = generate_fallback_full_plan(request)
        plan.source = "mock"
        plan.summary = f"[MOCK] Initial blueprint created for {request.title} ({request.event_type.value})."
        return plan

    async def generate_budget_breakdown(
        self, event_type: EventType, target_budget: Decimal, guest_count: int
    ) -> AIBudgetPlanResponse:
        plan = generate_fallback_budget(event_type, target_budget, guest_count)
        plan.disclaimer = "[MOCK] Deterministic budget breakdown generated for test/local mode."
        return plan

    async def generate_timeline(
        self, event_type: EventType, target_date_iso: Optional[str]
    ) -> AITimelinePlanResponse:
        return generate_fallback_timeline(event_type)

    async def generate_inspiration_ideas(
        self, event_type: EventType, theme: Optional[str], category: Optional[str], num_ideas: int
    ) -> List[AIInspirationIdea]:
        ideas = generate_fallback_inspiration(event_type, theme)
        if category:
            filtered = [idea for idea in ideas if category.lower() in idea.category.lower()]
            if filtered:
                ideas = filtered
        return ideas[:num_ideas]

    async def chat_copilot(
        self, request: AICopilotChatRequest, event_context: dict
    ) -> AICopilotChatResponse:
        reply = generate_fallback_chat_reply(request, event_context)
        reply.source = "mock"
        reply.response = f"[MOCK Copilot] {reply.response}"
        return reply

