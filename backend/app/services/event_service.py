from decimal import Decimal
from typing import List, Optional, Tuple
from math import ceil
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from fastapi import HTTPException, status

from app.models.event import Event, EventStatus, EventType
from app.models.budget import BudgetCategory, BudgetItem
from app.models.timeline import TimelineMilestone
from app.schemas.event import EventCreate, EventUpdate, EventPaginationResponse, EventResponse
from app.schemas.ai import AICopilotFullPlanResponse
from app.core.logging import logger


class EventService:
    @staticmethod
    def create_event(
        db: Session, event_in: EventCreate, owner_id: Optional[str] = None
    ) -> Event:
        try:
            event = Event(
                owner_id=owner_id,
                title=event_in.title,
                event_type=event_in.event_type.value,
                description=event_in.description,
                location=event_in.location,
                start_date=event_in.start_date,
                end_date=event_in.end_date,
                expected_guest_count=event_in.expected_guest_count,
                target_budget=event_in.target_budget,
                currency=event_in.currency,
                theme=event_in.theme,
                notes=event_in.notes,
                event_date=event_in.event_date,
                status=event_in.status.value if event_in.status else EventStatus.PLANNING.value,
            )
            db.add(event)
            db.commit()
            db.refresh(event)
            logger.info(f"Created event '{event.title}' with ID {event.id} (owner: {owner_id})")
            return event
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to create event: {str(exc)}")
            raise

    @staticmethod
    def get_event(db: Session, event_id: str) -> Event:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with ID '{event_id}' not found.",
            )
        return event

    @staticmethod
    def list_events(
        db: Session,
        skip: int = 0,
        limit: int = 50,
        event_type: Optional[EventType] = None,
        event_status: Optional[EventStatus] = None,
        search: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> List[Event]:
        query = db.query(Event)
        if owner_id:
            query = query.filter(Event.owner_id == owner_id)
        if event_type:
            query = query.filter(Event.event_type == event_type.value)
        if event_status:
            query = query.filter(Event.status == event_status.value)
        if search:
            query = query.filter(
                or_(
                    Event.title.ilike(f"%{search}%"),
                    Event.location.ilike(f"%{search}%"),
                    Event.description.ilike(f"%{search}%"),
                )
            )
        return query.order_by(desc(Event.created_at)).offset(skip).limit(limit).all()

    @staticmethod
    def list_events_paginated(
        db: Session,
        page: int = 1,
        page_size: int = 20,
        event_type: Optional[EventType] = None,
        event_status: Optional[EventStatus] = None,
        search: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> EventPaginationResponse:
        query = db.query(Event)
        if owner_id:
            query = query.filter(Event.owner_id == owner_id)
        if event_type:
            query = query.filter(Event.event_type == event_type.value)
        if event_status:
            query = query.filter(Event.status == event_status.value)
        if search:
            query = query.filter(
                or_(
                    Event.title.ilike(f"%{search}%"),
                    Event.location.ilike(f"%{search}%"),
                    Event.description.ilike(f"%{search}%"),
                )
            )

        total = query.count()
        total_pages = max(1, ceil(total / page_size)) if total > 0 else 1
        skip = (page - 1) * page_size
        items = query.order_by(desc(Event.created_at)).offset(skip).limit(page_size).all()

        return EventPaginationResponse(
            items=[EventResponse.model_validate(e) for e in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    @staticmethod
    def update_event(db: Session, event_id: str, event_in: EventUpdate) -> Event:
        event = EventService.get_event(db, event_id)
        update_data = event_in.model_dump(exclude_unset=True)

        try:
            for field, value in update_data.items():
                if field == "event_type" and value is not None:
                    setattr(event, field, value.value if hasattr(value, "value") else str(value))
                elif field == "status" and value is not None:
                    setattr(event, field, value.value if hasattr(value, "value") else str(value))
                elif field in ["name", "total_budget"]:
                    # aliases to title and target_budget
                    if field == "name" and value is not None:
                        event.title = value
                    elif field == "total_budget" and value is not None:
                        event.target_budget = value
                elif hasattr(event, field) and value is not None:
                    setattr(event, field, value)

            db.commit()
            db.refresh(event)
            logger.info(f"Updated event {event.id} ({event.title})")
            return event
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to update event {event_id}: {str(exc)}")
            raise

    @staticmethod
    def delete_event(db: Session, event_id: str) -> None:
        event = EventService.get_event(db, event_id)
        try:
            db.delete(event)
            db.commit()
            logger.info(f"Deleted event {event_id}")
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to delete event {event_id}: {str(exc)}")
            raise

    @staticmethod
    def apply_ai_plan_to_event(
        db: Session, event: Event, plan: AICopilotFullPlanResponse
    ) -> Event:
        """Hydrates the event with AI-generated or fallback budget categories, timeline milestones, and vendor checklists."""
        try:
            for alloc in plan.budget_breakdown.allocations:
                cat = BudgetCategory(
                    event_id=event.id,
                    name=alloc.category_name,
                    allocated_amount=alloc.suggested_amount,
                    percentage_target=alloc.percentage,
                )
                db.add(cat)
                db.flush()

                for item_title in alloc.recommended_items:
                    item = BudgetItem(
                        category_id=cat.id,
                        event_id=event.id,
                        title=item_title,
                        estimated_cost=Decimal("0.00"),
                        is_ai_suggested=True,
                    )
                    db.add(item)

            for idx, ms in enumerate(plan.timeline_plan.milestones):
                milestone = TimelineMilestone(
                    event_id=event.id,
                    title=ms.title,
                    phase=ms.phase,
                    recommended_timeline=ms.recommended_timeline,
                    key_tasks="\n".join(ms.key_tasks),
                    order_index=idx,
                )
                db.add(milestone)

            db.commit()
            db.refresh(event)
            return event
        except Exception as exc:
            db.rollback()
            logger.error(f"Failed to apply plan to event {event.id}: {str(exc)}")
            raise
