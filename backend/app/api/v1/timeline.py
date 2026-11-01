from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import (
    get_db,
    get_current_active_user,
    get_event_for_user,
    verify_event_access,
)
from app.models.event import Event
from app.models.user import User
from app.schemas.common import StandardResponse
from app.schemas.timeline import (
    TimelineMilestoneCreate,
    TimelineMilestoneUpdate,
    TimelineMilestoneResponse,
    TimelineActivityCreate,
    TimelineActivityUpdate,
    TimelineActivityResponse,
    TimelineOverviewResponse,
)
from app.services.timeline_service import TimelineService

router = APIRouter(tags=["Timeline Management"])


@router.get("/events/{event_id}/timeline", response_model=StandardResponse[TimelineOverviewResponse])
def get_event_timeline(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[TimelineOverviewResponse]:
    overview = TimelineService.get_timeline_overview(db, event.id)
    return StandardResponse(data=overview)


@router.post(
    "/events/{event_id}/timeline/milestones",
    response_model=StandardResponse[TimelineMilestoneResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_milestone(
    ms_in: TimelineMilestoneCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[TimelineMilestoneResponse]:
    milestone = TimelineService.create_milestone(db, event.id, ms_in)
    return StandardResponse(
        message="Milestone created successfully",
        data=TimelineMilestoneResponse.model_validate(milestone),
    )


@router.post(
    "/events/{event_id}/timeline/milestones/seed",
    response_model=StandardResponse[List[TimelineMilestoneResponse]],
    status_code=status.HTTP_201_CREATED,
)
def seed_milestones(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[TimelineMilestoneResponse]]:
    seeded = TimelineService.seed_default_milestones(db, event.id)
    return StandardResponse(
        message=f"Seeded {len(seeded)} standard milestones",
        data=[TimelineMilestoneResponse.model_validate(m) for m in seeded],
    )


@router.put(
    "/events/{event_id}/timeline/milestones/{milestone_id}",
    response_model=StandardResponse[TimelineMilestoneResponse],
)
@router.put(
    "/timeline/milestones/{milestone_id}",
    response_model=StandardResponse[TimelineMilestoneResponse],
)
def update_milestone(
    milestone_id: str,
    ms_in: TimelineMilestoneUpdate,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[TimelineMilestoneResponse]:
    if not event_id:
        from app.models.timeline import TimelineMilestone
        ms = db.query(TimelineMilestone).filter(TimelineMilestone.id == milestone_id).first()
        if not ms:
            raise HTTPException(status_code=404, detail="Milestone not found.")
        event_id = ms.event_id

    verify_event_access(db, event_id, current_user)
    updated = TimelineService.update_milestone(db, event_id, milestone_id, ms_in)
    return StandardResponse(
        message="Milestone updated successfully",
        data=TimelineMilestoneResponse.model_validate(updated),
    )


@router.delete(
    "/events/{event_id}/timeline/milestones/{milestone_id}",
    response_model=StandardResponse[None],
)
@router.delete(
    "/timeline/milestones/{milestone_id}",
    response_model=StandardResponse[None],
)
def delete_milestone(
    milestone_id: str,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    if not event_id:
        from app.models.timeline import TimelineMilestone
        ms = db.query(TimelineMilestone).filter(TimelineMilestone.id == milestone_id).first()
        if not ms:
            raise HTTPException(status_code=404, detail="Milestone not found.")
        event_id = ms.event_id

    verify_event_access(db, event_id, current_user)
    TimelineService.delete_milestone(db, event_id, milestone_id)
    return StandardResponse(message="Milestone deleted successfully")


@router.post(
    "/events/{event_id}/timeline/activities",
    response_model=StandardResponse[TimelineActivityResponse],
    status_code=status.HTTP_201_CREATED,
)
def add_activity(
    act_in: TimelineActivityCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[TimelineActivityResponse]:
    activity = TimelineService.create_activity(db, event.id, act_in)
    return StandardResponse(
        message="Activity scheduled successfully",
        data=TimelineActivityResponse.model_validate(activity),
    )


@router.put(
    "/events/{event_id}/timeline/activities/{activity_id}",
    response_model=StandardResponse[TimelineActivityResponse],
)
@router.put(
    "/timeline/activities/{activity_id}",
    response_model=StandardResponse[TimelineActivityResponse],
)
def update_activity(
    activity_id: str,
    act_in: TimelineActivityUpdate,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[TimelineActivityResponse]:
    if not event_id:
        from app.models.timeline import TimelineActivity
        act = db.query(TimelineActivity).filter(TimelineActivity.id == activity_id).first()
        if not act:
            raise HTTPException(status_code=404, detail="Activity not found.")
        event_id = act.event_id

    verify_event_access(db, event_id, current_user)
    updated = TimelineService.update_activity(db, event_id, activity_id, act_in)
    return StandardResponse(
        message="Activity updated successfully",
        data=TimelineActivityResponse.model_validate(updated),
    )


@router.delete(
    "/events/{event_id}/timeline/activities/{activity_id}",
    response_model=StandardResponse[None],
)
@router.delete(
    "/timeline/activities/{activity_id}",
    response_model=StandardResponse[None],
)
def delete_activity(
    activity_id: str,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    if not event_id:
        from app.models.timeline import TimelineActivity
        act = db.query(TimelineActivity).filter(TimelineActivity.id == activity_id).first()
        if not act:
            raise HTTPException(status_code=404, detail="Activity not found.")
        event_id = act.event_id

    verify_event_access(db, event_id, current_user)
    TimelineService.delete_activity(db, event_id, activity_id)
    return StandardResponse(message="Activity deleted successfully")
