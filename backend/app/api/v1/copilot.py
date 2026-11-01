from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    get_ai_orchestrator,
    get_current_active_user,
    get_event_for_user,
    verify_event_access,
    copilot_rate_limiter,
    ai_plan_rate_limiter,
)
from app.models.event import Event, EventType
from app.models.user import User
from app.schemas.common import StandardResponse
from app.schemas.ai import (
    AICopilotEventGenerationRequest,
    AICopilotFullPlanResponse,
    AIBudgetPlanResponse,
    AITimelinePlanResponse,
    AICopilotChatRequest,
)
from app.schemas.copilot import (
    CopilotThreadCreate,
    CopilotThreadResponse,
    CopilotMessageCreate,
    CopilotMessageResponse,
    AICopilotChatResponse,
    CopilotActionExecuteResponse,
    CopilotActionDismissResponse,
)
from app.services.ai.orchestrator import AICopilotOrchestrator
from app.services.event_service import EventService
from app.services.budget_service import BudgetService
from app.services.copilot_service import CopilotService
from app.services.copilot_context_builder import CopilotContextBuilder

router = APIRouter(tags=["AI Event Copilot"])


# ============================================================================
# Phase 5 Multi-Turn Conversation Thread Endpoints
# ============================================================================

@router.get(
    "/events/{event_id}/copilot/threads",
    response_model=StandardResponse[List[CopilotThreadResponse]],
)
def list_copilot_threads(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[CopilotThreadResponse]]:
    """List conversation threads for an event."""
    threads = CopilotService.list_threads(db, event.id)
    return StandardResponse(data=threads)


@router.post(
    "/events/{event_id}/copilot/threads",
    response_model=StandardResponse[CopilotThreadResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_copilot_thread(
    thread_in: Optional[CopilotThreadCreate] = None,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[CopilotThreadResponse]:
    """Create a new Copilot conversation thread for an event."""
    thread = CopilotService.create_thread(db, event.id, thread_in)
    return StandardResponse(
        message="Copilot thread created successfully",
        data=CopilotThreadResponse(
            id=thread.id,
            event_id=thread.event_id,
            title=thread.title,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
            message_count=0,
        ),
    )


@router.get(
    "/events/{event_id}/copilot/threads/{thread_id}/messages",
    response_model=StandardResponse[List[CopilotMessageResponse]],
)
def list_copilot_messages(
    thread_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[CopilotMessageResponse]]:
    """Retrieve chronological message history for a conversation thread."""
    messages = CopilotService.list_messages(db, event.id, thread_id)
    return StandardResponse(data=messages)


@router.post(
    "/events/{event_id}/copilot/threads/{thread_id}/messages",
    response_model=StandardResponse[AICopilotChatResponse],
)
async def send_copilot_message(
    thread_id: str,
    message_in: CopilotMessageCreate,
    event: Event = Depends(get_event_for_user),
    _rate_limit: None = Depends(copilot_rate_limiter),
    db: Session = Depends(get_db),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[AICopilotChatResponse]:
    """Send user message to Copilot with bounded event context, returning structured response with proposed actions."""
    res = await CopilotService.send_message(
        db, event.id, thread_id, message_in.content, ai
    )
    return StandardResponse(data=res)


@router.delete(
    "/events/{event_id}/copilot/threads/{thread_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_copilot_thread(
    thread_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
):
    """Delete a Copilot conversation thread and all its messages."""
    CopilotService.delete_thread(db, event.id, thread_id)
    return None


# ============================================================================
# Phase 5 Safe Action Approval & Lifecycle Endpoints
# ============================================================================

@router.post(
    "/events/{event_id}/copilot/actions/{action_id}/execute",
    response_model=StandardResponse[CopilotActionExecuteResponse],
)
@router.post(
    "/events/{event_id}/copilot/threads/{thread_id}/actions/{action_id}/execute",
    response_model=StandardResponse[CopilotActionExecuteResponse],
)
def execute_copilot_action(
    action_id: str,
    thread_id: Optional[str] = None,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[CopilotActionExecuteResponse]:
    """Explicitly approve and execute an AI-proposed action through domain services."""
    res = CopilotService.execute_action(db, event.id, action_id, thread_id=thread_id)
    return StandardResponse(
        message=res.message,
        data=res,
    )


@router.post(
    "/events/{event_id}/copilot/actions/{action_id}/dismiss",
    response_model=StandardResponse[CopilotActionDismissResponse],
)
@router.post(
    "/events/{event_id}/copilot/threads/{thread_id}/actions/{action_id}/dismiss",
    response_model=StandardResponse[CopilotActionDismissResponse],
)
def dismiss_copilot_action(
    action_id: str,
    thread_id: Optional[str] = None,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[CopilotActionDismissResponse]:
    """Dismiss an AI-proposed action without executing."""
    res = CopilotService.dismiss_action(db, event.id, action_id, thread_id=thread_id)
    return StandardResponse(
        message=res.message,
        data=res,
    )


@router.post(
    "/events/{event_id}/copilot/actions/{action_id}/reset",
    response_model=StandardResponse[CopilotActionDismissResponse],
)
@router.post(
    "/events/{event_id}/copilot/threads/{thread_id}/actions/{action_id}/reset",
    response_model=StandardResponse[CopilotActionDismissResponse],
)
def reset_copilot_action(
    action_id: str,
    thread_id: Optional[str] = None,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[CopilotActionDismissResponse]:
    """Resets an action in EXECUTING status back to PENDING status."""
    action = CopilotService.reset_action(db, event.id, action_id, thread_id=thread_id)
    return StandardResponse(
        message=f"Action '{action.title}' reset to PENDING.",
        data=CopilotActionDismissResponse(
            action_id=action.id,
            status=action.status,
            message=f"Action '{action.title}' reset to PENDING.",
        ),
    )


# ============================================================================
# Backward-Compatible Legacy AI Endpoints (Phases 1-4)
# ============================================================================

@router.post(
    "/copilot/generate-plan",
    response_model=StandardResponse[AICopilotFullPlanResponse],
)
async def generate_event_plan(
    request: AICopilotEventGenerationRequest,
    current_user: User = Depends(get_current_active_user),
    _rate_limit: None = Depends(ai_plan_rate_limiter),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[AICopilotFullPlanResponse]:
    """Generates a complete event blueprint using Gemini with schema enforcement and deterministic fallback."""
    plan = await ai.generate_full_event_plan(request)
    return StandardResponse(
        message=f"Event plan generated via {plan.source}",
        data=plan,
    )


@router.get(
    "/copilot/budget-recommendation",
    response_model=StandardResponse[AIBudgetPlanResponse],
)
async def get_budget_recommendation(
    event_type: EventType,
    target_budget: Decimal = Query(ge=0),
    guest_count: int = Query(default=50, ge=1),
    current_user: User = Depends(get_current_active_user),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[AIBudgetPlanResponse]:
    """Recommends category budget distribution percentages based on event type."""
    res = await ai.generate_budget_breakdown(event_type, target_budget, guest_count)
    return StandardResponse(data=res)


@router.get(
    "/copilot/timeline-recommendation",
    response_model=StandardResponse[AITimelinePlanResponse],
)
async def get_timeline_recommendation(
    event_type: EventType,
    current_user: User = Depends(get_current_active_user),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[AITimelinePlanResponse]:
    """Recommends phased planning milestones and sample day-of schedule."""
    res = await ai.generate_timeline(event_type)
    return StandardResponse(data=res)


@router.post(
    "/copilot/chat",
    response_model=StandardResponse[AICopilotChatResponse],
)
async def chat_copilot(
    request: AICopilotChatRequest,
    current_user: User = Depends(get_current_active_user),
    _rate_limit: None = Depends(copilot_rate_limiter),
    db: Session = Depends(get_db),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[AICopilotChatResponse]:
    """Contextual event copilot single-turn chat assistant (legacy compatibility)."""
    if request.event_id:
        verify_event_access(db, request.event_id, current_user)
    bounded_context = CopilotContextBuilder.build_bounded_context(db, request.event_id)
    res = await ai.chat_copilot(request, bounded_context)
    return StandardResponse(data=res)
