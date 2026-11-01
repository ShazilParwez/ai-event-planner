from typing import Optional, List
from fastapi import APIRouter, Depends, status, Query, Body, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import (
    get_db,
    get_current_active_user,
    get_event_for_user,
    verify_event_access,
)
from app.models.event import Event
from app.models.user import User
from app.models.guest import Guest, RSVPStatus, InvitationStatus
from app.schemas.common import StandardResponse
from app.schemas.guest import (
    GuestCreate,
    GuestUpdate,
    GuestResponse,
    GuestAnalyticsResponse,
    GuestListResponse,
    GuestSummaryResponse,
)
from app.services.guest_service import GuestService

router = APIRouter(tags=["Guest Management"])


@router.get("/events/{event_id}/guests", response_model=StandardResponse[GuestListResponse])
def list_event_guests(
    search: Optional[str] = Query(default=None, description="Search by name, email, or phone"),
    category: Optional[str] = Query(default=None, description="Filter by guest category"),
    rsvp_status: Optional[str] = Query(default=None, description="Filter by RSVP status"),
    invitation_status: Optional[str] = Query(default=None, description="Filter by invitation status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestListResponse]:
    result = GuestService.list_guests(
        db=db,
        event_id=event.id,
        search=search,
        category=category,
        rsvp_status=rsvp_status,
        invitation_status=invitation_status,
        page=page,
        page_size=page_size,
    )
    return StandardResponse(data=result)


@router.get("/events/{event_id}/guests/analytics", response_model=StandardResponse[GuestAnalyticsResponse])
def get_guest_analytics(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestAnalyticsResponse]:
    analytics = GuestService.get_guest_analytics(db=db, event_id=event.id)
    return StandardResponse(data=analytics)


@router.get("/events/{event_id}/guests/summary", response_model=StandardResponse[GuestSummaryResponse])
def get_event_guests_summary(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestSummaryResponse]:
    analytics = GuestService.get_guest_analytics(db=db, event_id=event.id)
    list_res = GuestService.list_guests(db=db, event_id=event.id, page_size=200)

    summary = GuestSummaryResponse(
        event_id=event.id,
        total_invitations=analytics.total_invited,
        total_attending_heads=analytics.confirmed_guests + analytics.confirmed_plus_ones,
        total_declined_heads=analytics.declined_guests,
        total_pending_heads=analytics.pending_responses,
        dietary_breakdown=analytics.dietary_preference_distribution,
        guests=list_res.items,
    )
    return StandardResponse(data=summary)


@router.post(
    "/events/{event_id}/guests",
    response_model=StandardResponse[GuestResponse],
    status_code=status.HTTP_201_CREATED,
)
def add_guest(
    guest_in: GuestCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestResponse]:
    created = GuestService.create_guest(db=db, event_id=event.id, guest_in=guest_in)
    return StandardResponse(
        message="Guest added to roster",
        data=created,
    )


@router.get("/events/{event_id}/guests/{guest_id}", response_model=StandardResponse[GuestResponse])
def get_single_guest(
    guest_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestResponse]:
    guest = GuestService.get_guest(db=db, event_id=event.id, guest_id=guest_id)
    resp = GuestResponse.model_validate(guest)
    resp.total_party_count = 1 + (guest.plus_ones or 0)
    return StandardResponse(data=resp)


@router.put("/events/{event_id}/guests/{guest_id}", response_model=StandardResponse[GuestResponse])
def update_guest(
    guest_id: str,
    guest_in: GuestUpdate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestResponse]:
    updated = GuestService.update_guest(db=db, event_id=event.id, guest_id=guest_id, guest_in=guest_in)
    return StandardResponse(
        message="Guest updated successfully",
        data=updated,
    )


@router.delete("/events/{event_id}/guests/{guest_id}", response_model=StandardResponse[None])
def delete_guest(
    guest_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    GuestService.delete_guest(db=db, event_id=event.id, guest_id=guest_id)
    return StandardResponse(message="Guest removed successfully")


@router.patch("/events/{event_id}/guests/{guest_id}/rsvp", response_model=StandardResponse[GuestResponse])
def update_guest_rsvp(
    guest_id: str,
    rsvp_status: str = Body(..., embed=True),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestResponse]:
    updated = GuestService.quick_update_rsvp(db=db, event_id=event.id, guest_id=guest_id, rsvp_status=rsvp_status)
    return StandardResponse(
        message=f"RSVP status updated to {rsvp_status}",
        data=updated,
    )


@router.patch("/events/{event_id}/guests/{guest_id}/invitation", response_model=StandardResponse[GuestResponse])
def update_guest_invitation(
    guest_id: str,
    invitation_status: str = Body(..., embed=True),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestResponse]:
    updated = GuestService.quick_update_invitation(db=db, event_id=event.id, guest_id=guest_id, invitation_status=invitation_status)
    return StandardResponse(
        message=f"Invitation status updated to {invitation_status}",
        data=updated,
    )


# Backward-compatible routes
@router.put("/guests/{guest_id}", response_model=StandardResponse[GuestResponse])
def update_guest_legacy(
    guest_id: str,
    guest_in: GuestUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[GuestResponse]:
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found.")
    verify_event_access(db, guest.event_id, current_user)
    updated = GuestService.update_guest(db=db, event_id=guest.event_id, guest_id=guest_id, guest_in=guest_in)
    return StandardResponse(
        message="Guest updated successfully",
        data=updated,
    )


@router.delete("/guests/{guest_id}", response_model=StandardResponse[None])
def delete_guest_legacy(
    guest_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found.")
    verify_event_access(db, guest.event_id, current_user)
    GuestService.delete_guest(db=db, event_id=guest.event_id, guest_id=guest_id)
    return StandardResponse(message="Guest removed successfully")
