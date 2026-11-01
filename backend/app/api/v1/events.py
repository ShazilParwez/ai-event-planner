from typing import List, Optional, Union
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from app.api.deps import (
    get_db,
    get_ai_orchestrator,
    get_current_active_user,
    get_event_for_user,
    ai_plan_rate_limiter,
)
from app.models.event import Event, EventType, EventStatus
from app.models.user import User
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventPaginationResponse,
)
from app.schemas.common import StandardResponse
from app.schemas.ai import AICopilotEventGenerationRequest
from app.services.event_service import EventService
from app.services.ai.orchestrator import AICopilotOrchestrator

router = APIRouter(prefix="/events", tags=["Events"])


@router.post("", response_model=StandardResponse[EventResponse], status_code=status.HTTP_201_CREATED)
def create_event(
    event_in: EventCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[EventResponse]:
    """Creates a new event associated with the authenticated user with deterministic defaults and ISO currency validation."""
    event = EventService.create_event(db, event_in, owner_id=current_user.id)
    return StandardResponse(
        message="Event created successfully",
        data=EventResponse.model_validate(event),
    )


@router.post("/with-ai-plan", response_model=StandardResponse[EventResponse], status_code=status.HTTP_201_CREATED)
async def create_event_with_ai_plan(
    event_in: EventCreate,
    guest_count: int = Query(default=50, ge=1, le=5000),
    current_user: User = Depends(get_current_active_user),
    _rate_limit: None = Depends(ai_plan_rate_limiter),
    db: Session = Depends(get_db),
    ai: AICopilotOrchestrator = Depends(get_ai_orchestrator),
) -> StandardResponse[EventResponse]:
    """Creates an event owned by the authenticated user and automatically bootstraps budget categories, milestones, and checklists using AI Copilot."""
    event = EventService.create_event(db, event_in, owner_id=current_user.id)

    ai_request = AICopilotEventGenerationRequest(
        title=event.title,
        event_type=event_in.event_type,
        target_budget=event.target_budget,
        guest_count=guest_count or event.expected_guest_count or 50,
        location=event.location,
        theme=event.theme,
        notes=event.notes or event.description,
    )
    plan = await ai.generate_full_event_plan(ai_request)
    EventService.apply_ai_plan_to_event(db, event, plan)

    return StandardResponse(
        message=f"Event created with {plan.source} AI-assisted blueprint",
        data=EventResponse.model_validate(event),
    )


@router.get("", response_model=StandardResponse[List[EventResponse]])
def list_events(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    event_type: Optional[EventType] = Query(default=None),
    status: Optional[EventStatus] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[EventResponse]]:
    """Lists events owned by the authenticated user (or all events if superuser) with filtering, search, and pagination."""
    owner_id = None if current_user.is_superuser else current_user.id
    events = EventService.list_events(
        db,
        skip=skip,
        limit=limit,
        event_type=event_type,
        event_status=status,
        search=search,
        owner_id=owner_id,
    )
    return StandardResponse(
        data=[EventResponse.model_validate(e) for e in events]
    )


@router.get("/paginated", response_model=StandardResponse[EventPaginationResponse])
def list_events_paginated(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    event_type: Optional[EventType] = Query(default=None),
    status: Optional[EventStatus] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[EventPaginationResponse]:
    """Returns paginated event listing owned by the current user (or all if superuser) with total count and page metadata."""
    owner_id = None if current_user.is_superuser else current_user.id
    res = EventService.list_events_paginated(
        db,
        page=page,
        page_size=page_size,
        event_type=event_type,
        event_status=status,
        search=search,
        owner_id=owner_id,
    )
    return StandardResponse(data=res)


@router.get("/{event_id}", response_model=StandardResponse[EventResponse])
def get_event(
    event: Event = Depends(get_event_for_user),
) -> StandardResponse[EventResponse]:
    """Retrieves a single event by ID with ownership verification or returns 404/403."""
    return StandardResponse(data=EventResponse.model_validate(event))


@router.put("/{event_id}", response_model=StandardResponse[EventResponse])
def update_event(
    event_in: EventUpdate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[EventResponse]:
    """Updates an existing event owned by the authenticated user."""
    updated = EventService.update_event(db, event.id, event_in)
    return StandardResponse(
        message="Event updated successfully",
        data=EventResponse.model_validate(updated),
    )


@router.delete("/{event_id}", response_model=StandardResponse[None])
def delete_event(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    """Deletes an event owned by the authenticated user and cascades to associated entities."""
    EventService.delete_event(db, event.id)
    return StandardResponse(message="Event deleted successfully")
