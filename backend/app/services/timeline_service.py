from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.event import Event
from app.models.timeline import TimelineMilestone, TimelineActivity, MilestoneStatus, MilestonePriority
from app.schemas.timeline import (
    TimelineMilestoneCreate,
    TimelineMilestoneUpdate,
    TimelineMilestoneResponse,
    TimelineActivityCreate,
    TimelineActivityUpdate,
    TimelineActivityResponse,
    TimelineOverviewResponse,
)
from app.services.event_service import EventService


DEFAULT_MILESTONE_TEMPLATES = [
    {"title": "Initial Planning & Budget Strategy", "phase": "6_MONTHS_BEFORE", "priority": MilestonePriority.CRITICAL.value, "order_index": 0, "offset_days": -180, "description": "Define overall event concept, budget limits, and core planning team."},
    {"title": "Venue Selection & Palace Booking", "phase": "5_MONTHS_BEFORE", "priority": MilestonePriority.HIGH.value, "order_index": 1, "offset_days": -150, "description": "Tour potential venues, negotiate contracts, and confirm booking deposits."},
    {"title": "Key Vendor Contracting", "phase": "4_MONTHS_BEFORE", "priority": MilestonePriority.HIGH.value, "order_index": 2, "offset_days": -120, "description": "Lock in catering, photography, and decor partners."},
    {"title": "Invitations & Guest Outreach", "phase": "3_MONTHS_BEFORE", "priority": MilestonePriority.MEDIUM.value, "order_index": 3, "offset_days": -90, "description": "Design invitations, compile guest directory, and begin RSVP tracking."},
    {"title": "Catering Tasting & Menu Finalization", "phase": "2_MONTHS_BEFORE", "priority": MilestonePriority.MEDIUM.value, "order_index": 4, "offset_days": -60, "description": "Sample dishes, confirm beverage pairings, and note dietary restrictions."},
    {"title": "Theme Decor & Floral Production", "phase": "1_MONTH_BEFORE", "priority": MilestonePriority.MEDIUM.value, "order_index": 5, "offset_days": -30, "description": "Finalize stage layout, seating arrangements, and floral arrangements."},
    {"title": "Final Rehearsal & Vendor Sync", "phase": "1_WEEK_BEFORE", "priority": MilestonePriority.HIGH.value, "order_index": 6, "offset_days": -7, "description": "Conduct walk-through with all key vendors and verify minute-by-minute schedule."},
    {"title": "Event Day Execution & Run of Show", "phase": "DAY_OF", "priority": MilestonePriority.CRITICAL.value, "order_index": 7, "offset_days": 0, "description": "Coordinate on-site arrivals, ceremony timelines, and guest hospitality."},
]


class TimelineService:
    @staticmethod
    def get_timeline_overview(db: Session, event_id: str) -> TimelineOverviewResponse:
        event = EventService.get_event(db, event_id)
        milestones = (
            db.query(TimelineMilestone)
            .filter(TimelineMilestone.event_id == event.id)
            .order_by(TimelineMilestone.order_index, TimelineMilestone.created_at)
            .all()
        )
        activities = (
            db.query(TimelineActivity)
            .filter(TimelineActivity.event_id == event.id)
            .order_by(TimelineActivity.start_time, TimelineActivity.order_index)
            .all()
        )

        now = datetime.now(timezone.utc)
        ms_responses: List[TimelineMilestoneResponse] = []
        completed_count = 0
        pending_count = 0
        overdue_count = 0

        for m in milestones:
            is_completed = (m.status == MilestoneStatus.COMPLETED.value)
            if is_completed:
                completed_count += 1
            else:
                pending_count += 1

            # Determine overdue status
            is_overdue = False
            if m.target_date and not is_completed:
                target_utc = m.target_date if m.target_date.tzinfo else m.target_date.replace(tzinfo=timezone.utc)
                if target_utc < now:
                    is_overdue = True
                    overdue_count += 1

            # Activities for this milestone
            m_activities = [
                TimelineActivityResponse.model_validate(act)
                for act in activities
                if act.milestone_id == m.id
            ]

            ms_resp = TimelineMilestoneResponse(
                id=m.id,
                event_id=m.event_id,
                title=m.title,
                phase=m.phase,
                target_date=m.target_date,
                due_date=m.target_date,
                status=MilestoneStatus(m.status) if m.status in MilestoneStatus.__members__ else MilestoneStatus.PENDING,
                priority=MilestonePriority(m.priority) if m.priority in MilestonePriority.__members__ else MilestonePriority.MEDIUM,
                description=m.description,
                order_index=m.order_index,
                is_ai_suggested=m.is_ai_suggested,
                is_completed=is_completed,
                is_overdue=is_overdue,
                created_at=m.created_at,
                updated_at=m.updated_at,
                activities=m_activities,
            )
            ms_responses.append(ms_resp)

        total_milestones = len(milestones)
        pct = (completed_count / total_milestones * 100.0) if total_milestones > 0 else 0.0

        return TimelineOverviewResponse(
            event_id=event.id,
            total_milestones=total_milestones,
            completed_milestones=completed_count,
            pending_milestones=pending_count,
            overdue_milestones=overdue_count,
            completion_percentage=round(pct, 1),
            milestones=ms_responses,
            activities=[TimelineActivityResponse.model_validate(a) for a in activities],
        )

    @staticmethod
    def create_milestone(db: Session, event_id: str, ms_in: TimelineMilestoneCreate) -> TimelineMilestone:
        event = EventService.get_event(db, event_id)
        
        # Calculate next order index if not specified
        if ms_in.order_index == 0:
            max_order = db.query(TimelineMilestone).filter(TimelineMilestone.event_id == event.id).count()
            order_index = max_order
        else:
            order_index = ms_in.order_index

        target_date = ms_in.target_date or ms_in.due_date

        milestone = TimelineMilestone(
            event_id=event.id,
            title=ms_in.title,
            phase=ms_in.phase,
            target_date=target_date,
            status=ms_in.status.value,
            priority=ms_in.priority.value,
            description=ms_in.description,
            order_index=order_index,
            is_ai_suggested=ms_in.is_ai_suggested,
        )
        db.add(milestone)
        db.commit()
        db.refresh(milestone)
        return milestone

    @staticmethod
    def update_milestone(
        db: Session, event_id: str, milestone_id: str, ms_in: TimelineMilestoneUpdate
    ) -> TimelineMilestone:
        event = EventService.get_event(db, event_id)
        milestone = (
            db.query(TimelineMilestone)
            .filter(TimelineMilestone.id == milestone_id, TimelineMilestone.event_id == event.id)
            .first()
        )
        if not milestone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Milestone '{milestone_id}' not found for event '{event_id}'.",
            )

        update_data = ms_in.model_dump(exclude_unset=True)
        for field, val in update_data.items():
            if field == "status" and val is not None:
                milestone.status = val.value
            elif field == "priority" and val is not None:
                milestone.priority = val.value
            elif field in ("target_date", "due_date") and val is not None:
                milestone.target_date = val
            elif field != "due_date":
                setattr(milestone, field, val)

        db.commit()
        db.refresh(milestone)
        return milestone

    @staticmethod
    def delete_milestone(db: Session, event_id: str, milestone_id: str) -> None:
        event = EventService.get_event(db, event_id)
        milestone = (
            db.query(TimelineMilestone)
            .filter(TimelineMilestone.id == milestone_id, TimelineMilestone.event_id == event.id)
            .first()
        )
        if not milestone:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Milestone '{milestone_id}' not found for event '{event_id}'.",
            )
        db.delete(milestone)
        db.commit()

    @staticmethod
    def seed_default_milestones(db: Session, event_id: str) -> List[TimelineMilestone]:
        event = EventService.get_event(db, event_id)
        base_date = event.start_date or (datetime.now(timezone.utc) + timedelta(days=180))

        seeded: List[TimelineMilestone] = []
        for template in DEFAULT_MILESTONE_TEMPLATES:
            # Check if milestone with same title already exists
            existing = (
                db.query(TimelineMilestone)
                .filter(
                    TimelineMilestone.event_id == event.id,
                    TimelineMilestone.title == template["title"],
                )
                .first()
            )
            if not existing:
                target_dt = base_date + timedelta(days=template["offset_days"])
                ms = TimelineMilestone(
                    event_id=event.id,
                    title=template["title"],
                    phase=template["phase"],
                    priority=template["priority"],
                    order_index=template["order_index"],
                    target_date=target_dt,
                    description=template["description"],
                    status=MilestoneStatus.PENDING.value,
                    is_ai_suggested=False,
                )
                db.add(ms)
                seeded.append(ms)

        db.commit()
        for ms in seeded:
            db.refresh(ms)
        return seeded

    @staticmethod
    def create_activity(
        db: Session, event_id: str, act_in: TimelineActivityCreate
    ) -> TimelineActivity:
        event = EventService.get_event(db, event_id)

        # Cross-event isolation: if milestone_id provided, verify it belongs to this event
        if act_in.milestone_id:
            ms = (
                db.query(TimelineMilestone)
                .filter(
                    TimelineMilestone.id == act_in.milestone_id,
                    TimelineMilestone.event_id == event.id,
                )
                .first()
            )
            if not ms:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Milestone '{act_in.milestone_id}' does not belong to event '{event_id}'.",
                )

        if act_in.end_time and act_in.end_time < act_in.start_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Activity end_time cannot be earlier than start_time.",
            )

        activity = TimelineActivity(
            event_id=event.id,
            milestone_id=act_in.milestone_id,
            title=act_in.title,
            start_time=act_in.start_time,
            end_time=act_in.end_time,
            responsible_party=act_in.responsible_party,
            location=act_in.location,
            status=act_in.status,
            order_index=act_in.order_index,
            description=act_in.description,
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity

    @staticmethod
    def update_activity(
        db: Session, event_id: str, activity_id: str, act_in: TimelineActivityUpdate
    ) -> TimelineActivity:
        event = EventService.get_event(db, event_id)
        activity = (
            db.query(TimelineActivity)
            .filter(TimelineActivity.id == activity_id, TimelineActivity.event_id == event.id)
            .first()
        )
        if not activity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity '{activity_id}' not found for event '{event_id}'.",
            )

        update_data = act_in.model_dump(exclude_unset=True)

        # Cross-event milestone validation
        if "milestone_id" in update_data and update_data["milestone_id"]:
            ms = (
                db.query(TimelineMilestone)
                .filter(
                    TimelineMilestone.id == update_data["milestone_id"],
                    TimelineMilestone.event_id == event.id,
                )
                .first()
            )
            if not ms:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Milestone '{update_data['milestone_id']}' does not belong to event '{event_id}'.",
                )

        # Validate date range
        new_start = update_data.get("start_time", activity.start_time)
        new_end = update_data.get("end_time", activity.end_time)
        if new_end and new_start and new_end < new_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Activity end_time cannot be earlier than start_time.",
            )

        for field, val in update_data.items():
            setattr(activity, field, val)

        db.commit()
        db.refresh(activity)
        return activity

    @staticmethod
    def delete_activity(db: Session, event_id: str, activity_id: str) -> None:
        event = EventService.get_event(db, event_id)
        activity = (
            db.query(TimelineActivity)
            .filter(TimelineActivity.id == activity_id, TimelineActivity.event_id == event.id)
            .first()
        )
        if not activity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity '{activity_id}' not found for event '{event_id}'.",
            )
        db.delete(activity)
        db.commit()

