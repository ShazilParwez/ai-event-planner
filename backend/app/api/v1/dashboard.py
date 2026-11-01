from typing import Dict, Any, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_db, get_event_for_user
from app.models.event import Event
from app.models.timeline import TimelineMilestone
from app.models.vendor import VendorItem, VendorStatus
from app.models.guest import Guest, RSVPStatus
from app.schemas.common import StandardResponse
from app.schemas.event import EventResponse
from app.services.budget_service import BudgetService

router = APIRouter(tags=["Dashboard & Analytics"])


class EventDashboardMetrics(BaseModel):
    event: EventResponse
    budget: Dict[str, Any]
    timeline: Dict[str, Any]
    vendors: Dict[str, Any]
    guests: Dict[str, Any]


@router.get("/events/{event_id}/dashboard", response_model=StandardResponse[EventDashboardMetrics])
def get_event_dashboard(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[EventDashboardMetrics]:
    budget_overview = BudgetService.calculate_overview(event, db)

    # Timeline stats
    milestones = db.query(TimelineMilestone).filter(TimelineMilestone.event_id == event.id).all()
    completed_milestones = sum(1 for m in milestones if m.status == "COMPLETED")
    timeline_pct = (completed_milestones / len(milestones) * 100.0) if milestones else 0.0

    # Vendor stats
    vendors = db.query(VendorItem).filter(VendorItem.event_id == event.id).all()
    hired_vendors = sum(1 for v in vendors if v.status == VendorStatus.HIRED.value)

    # Guest stats
    guests = db.query(Guest).filter(Guest.event_id == event.id).all()
    attending = sum((1 + g.plus_ones) for g in guests if g.rsvp_status == RSVPStatus.ATTENDING.value)
    pending = sum((1 + g.plus_ones) for g in guests if g.rsvp_status == RSVPStatus.PENDING.value)

    metrics = EventDashboardMetrics(
        event=EventResponse.model_validate(event),
        budget={
            "target_budget": float(budget_overview.target_budget),
            "total_estimated": float(budget_overview.total_estimated),
            "total_actual": float(budget_overview.total_actual),
            "remaining_budget": float(budget_overview.remaining_budget),
            "variance": float(budget_overview.variance),
            "is_over_budget": budget_overview.is_over_budget,
        },
        timeline={
            "total_milestones": len(milestones),
            "completed_milestones": completed_milestones,
            "completion_percentage": round(timeline_pct, 1),
        },
        vendors={
            "total": len(vendors),
            "hired": hired_vendors,
            "pending": len(vendors) - hired_vendors,
        },
        guests={
            "total_invitations": len(guests),
            "attending_heads": attending,
            "pending_heads": pending,
        },
    )

    return StandardResponse(data=metrics)

