from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user, verify_event_access
from app.models.user import User
from app.schemas.common import StandardResponse
from app.schemas.accessibility import (
    AccessibilityProfileInput,
    VenueAccessibilityInput,
    EventAccessibilityResponse,
    AccessibilityPlanResponse,
)
from app.services.accessibility_service import AccessibilityService


router = APIRouter(prefix="/events/{event_id}/accessibility", tags=["Accessibility Planning"])


@router.get(
    "",
    response_model=StandardResponse[EventAccessibilityResponse],
    summary="Get event accessibility profile, venue status, and plan",
)
def get_event_accessibility(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse[EventAccessibilityResponse]:
    """Retrieves the complete accessibility profile, venue facility status, and plan for an event."""
    event = verify_event_access(db, event_id, current_user)
    record = AccessibilityService.get_or_create(db, event.id)
    return StandardResponse(
        message="Accessibility profile retrieved successfully",
        data=EventAccessibilityResponse.model_validate(record),
    )


@router.put(
    "/profile",
    response_model=StandardResponse[EventAccessibilityResponse],
    summary="Update event accessibility profile requirements",
)
def update_accessibility_profile(
    event_id: str,
    profile_in: AccessibilityProfileInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse[EventAccessibilityResponse]:
    """Updates the configured accessibility requirements and accommodations needed for an event."""
    event = verify_event_access(db, event_id, current_user)
    record = AccessibilityService.update_profile(db, event.id, profile_in)
    return StandardResponse(
        message="Accessibility profile updated successfully",
        data=EventAccessibilityResponse.model_validate(record),
    )


@router.put(
    "/venue",
    response_model=StandardResponse[EventAccessibilityResponse],
    summary="Update venue facilities verification, routes, and emergency assistance",
)
def update_venue_accessibility(
    event_id: str,
    venue_in: VenueAccessibilityInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse[EventAccessibilityResponse]:
    """Updates verified venue facilities, route accessibility, and emergency assistance contacts."""
    event = verify_event_access(db, event_id, current_user)
    record = AccessibilityService.update_venue(db, event.id, venue_in)
    return StandardResponse(
        message="Venue accessibility updated successfully",
        data=EventAccessibilityResponse.model_validate(record),
    )


@router.post(
    "/plan",
    response_model=StandardResponse[AccessibilityPlanResponse],
    status_code=status.HTTP_200_OK,
    summary="Generate or refresh personalized accessibility plan",
)
def generate_accessibility_plan(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse[AccessibilityPlanResponse]:
    """
    Synthesizes a personalized accessibility plan with barrier analysis,
    route guidance, facility checklists, and confidence explanations.
    """
    event = verify_event_access(db, event_id, current_user)
    plan = AccessibilityService.generate_plan(db, event)
    return StandardResponse(
        message="Accessibility plan generated successfully",
        data=plan,
    )


@router.get(
    "/plan",
    response_model=StandardResponse[AccessibilityPlanResponse],
    summary="Retrieve current accessibility plan",
)
def get_accessibility_plan(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StandardResponse[AccessibilityPlanResponse]:
    """Retrieves the latest generated accessibility plan, generating one if not yet created."""
    event = verify_event_access(db, event_id, current_user)
    record = AccessibilityService.get_or_create(db, event.id)
    if record.generated_plan:
        plan = AccessibilityPlanResponse.model_validate(record.generated_plan)
    else:
        plan = AccessibilityService.generate_plan(db, event)
    return StandardResponse(
        message="Accessibility plan retrieved successfully",
        data=plan,
    )

