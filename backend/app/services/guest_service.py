import math
from typing import List, Dict, Optional
from collections import Counter
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.guest import Guest, RSVPStatus, GuestCategory, InvitationStatus
from app.schemas.guest import (
    GuestCreate,
    GuestUpdate,
    GuestResponse,
    GuestAnalyticsResponse,
    GuestListResponse,
    GuestSummaryResponse,
)
from app.services.event_service import EventService


class GuestService:
    @staticmethod
    def get_guest_analytics(db: Session, event_id: str) -> GuestAnalyticsResponse:
        EventService.get_event(db, event_id)
        guests = db.query(Guest).filter(Guest.event_id == event_id).all()

        total_guests = len(guests)
        confirmed_guests = 0
        declined_guests = 0
        pending_responses = 0
        maybe_responses = 0
        total_plus_ones = 0
        confirmed_plus_ones = 0
        total_invited = 0

        dietary_counter: Counter = Counter()
        category_counter: Counter = Counter({
            GuestCategory.FAMILY.value: 0,
            GuestCategory.FRIENDS.value: 0,
            GuestCategory.COLLEAGUES.value: 0,
            GuestCategory.VIP.value: 0,
            GuestCategory.COMMUNITY.value: 0,
            GuestCategory.OTHER.value: 0,
        })
        rsvp_counter: Counter = Counter({
            RSVPStatus.INVITED.value: 0,
            RSVPStatus.CONFIRMED.value: 0,
            RSVPStatus.DECLINED.value: 0,
            RSVPStatus.MAYBE.value: 0,
            RSVPStatus.WAITING.value: 0,
        })

        for g in guests:
            # Invitation tracking
            if g.invitation_status == InvitationStatus.SENT.value or g.rsvp_status in [
                RSVPStatus.INVITED.value,
                RSVPStatus.CONFIRMED.value,
                RSVPStatus.DECLINED.value,
                RSVPStatus.MAYBE.value,
            ]:
                total_invited += 1

            # Plus-ones
            p_ones = g.plus_ones or 0
            total_plus_ones += p_ones

            # RSVP breakdown
            status_val = g.rsvp_status
            if status_val in [RSVPStatus.CONFIRMED.value, RSVPStatus.ATTENDING.value]:
                confirmed_guests += 1
                confirmed_plus_ones += p_ones
                rsvp_counter[RSVPStatus.CONFIRMED.value] += 1
            elif status_val == RSVPStatus.DECLINED.value:
                declined_guests += 1
                rsvp_counter[RSVPStatus.DECLINED.value] += 1
            elif status_val == RSVPStatus.MAYBE.value:
                maybe_responses += 1
                rsvp_counter[RSVPStatus.MAYBE.value] += 1
            else:  # INVITED, WAITING, PENDING
                pending_responses += 1
                if status_val in rsvp_counter:
                    rsvp_counter[status_val] += 1
                else:
                    rsvp_counter[RSVPStatus.WAITING.value] += 1

            # Category distribution
            cat = g.category or GuestCategory.OTHER.value
            category_counter[cat] += 1

            # Dietary preferences distribution
            dietary = g.dietary_preferences or g.dietary_restrictions
            if dietary and dietary.strip():
                # Handle comma-separated dietary items
                items = [item.strip() for item in dietary.split(",") if item.strip()]
                for item in items:
                    dietary_counter[item.title()] += 1

        expected_attendance = confirmed_guests + confirmed_plus_ones
        attendance_rate = (
            round((confirmed_guests / total_guests) * 100.0, 1)
            if total_guests > 0
            else 0.0
        )

        return GuestAnalyticsResponse(
            total_guests=total_guests,
            total_invited=total_invited,
            confirmed_guests=confirmed_guests,
            declined_guests=declined_guests,
            pending_responses=pending_responses,
            maybe_responses=maybe_responses,
            expected_attendance=expected_attendance,
            total_plus_ones=total_plus_ones,
            confirmed_plus_ones=confirmed_plus_ones,
            attendance_rate=attendance_rate,
            dietary_preference_distribution=dict(dietary_counter),
            guest_category_distribution=dict(category_counter),
            rsvp_status_distribution=dict(rsvp_counter),
        )

    @staticmethod
    def list_guests(
        db: Session,
        event_id: str,
        search: Optional[str] = None,
        category: Optional[str] = None,
        rsvp_status: Optional[str] = None,
        invitation_status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> GuestListResponse:
        EventService.get_event(db, event_id)
        query = db.query(Guest).filter(Guest.event_id == event_id)

        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                (Guest.name.ilike(term))
                | (Guest.email.ilike(term))
                | (Guest.phone.ilike(term))
                | (Guest.table_assignment.ilike(term))
            )

        if category and category.strip():
            query = query.filter(Guest.category == category.strip())

        if rsvp_status and rsvp_status.strip():
            status_query = rsvp_status.strip().upper()
            if status_query == "CONFIRMED":
                query = query.filter(Guest.rsvp_status.in_([RSVPStatus.CONFIRMED.value, RSVPStatus.ATTENDING.value]))
            else:
                query = query.filter(Guest.rsvp_status == status_query)

        if invitation_status and invitation_status.strip():
            query = query.filter(Guest.invitation_status == invitation_status.strip().upper())

        total = query.count()
        total_pages = max(1, math.ceil(total / page_size)) if page_size > 0 else 1
        offset = max(0, (page - 1) * page_size)

        guest_rows = (
            query.order_by(Guest.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        items: List[GuestResponse] = []
        for g in guest_rows:
            resp = GuestResponse.model_validate(g)
            resp.total_party_count = 1 + (g.plus_ones or 0)
            items.append(resp)

        analytics = GuestService.get_guest_analytics(db, event_id)

        return GuestListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            analytics=analytics,
        )

    @staticmethod
    def get_guest(db: Session, event_id: str, guest_id: str) -> Guest:
        guest = (
            db.query(Guest)
            .filter(Guest.id == guest_id, Guest.event_id == event_id)
            .first()
        )
        if not guest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Guest with id '{guest_id}' not found for event '{event_id}'",
            )
        return guest

    @staticmethod
    def create_guest(db: Session, event_id: str, guest_in: GuestCreate) -> GuestResponse:
        EventService.get_event(db, event_id)

        dietary = guest_in.dietary_preferences or guest_in.dietary_restrictions

        guest = Guest(
            event_id=event_id,
            name=guest_in.name,
            email=guest_in.email,
            phone=guest_in.phone,
            category=guest_in.category or GuestCategory.FRIENDS.value,
            rsvp_status=guest_in.rsvp_status.value if hasattr(guest_in.rsvp_status, "value") else str(guest_in.rsvp_status),
            invitation_status=guest_in.invitation_status.value if hasattr(guest_in.invitation_status, "value") else str(guest_in.invitation_status),
            plus_ones=guest_in.plus_ones or 0,
            dietary_preferences=dietary,
            dietary_restrictions=dietary,
            accessibility_requirements=guest_in.accessibility_requirements,
            table_assignment=guest_in.table_assignment,
            notes=guest_in.notes,
        )
        db.add(guest)
        db.commit()
        db.refresh(guest)

        resp = GuestResponse.model_validate(guest)
        resp.total_party_count = 1 + guest.plus_ones
        return resp

    @staticmethod
    def update_guest(
        db: Session, event_id: str, guest_id: str, guest_in: GuestUpdate
    ) -> GuestResponse:
        guest = GuestService.get_guest(db, event_id, guest_id)

        update_data = guest_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "rsvp_status" and value is not None:
                val = value.value if hasattr(value, "value") else str(value)
                setattr(guest, field, val)
            elif field == "invitation_status" and value is not None:
                val = value.value if hasattr(value, "value") else str(value)
                setattr(guest, field, val)
            elif field in ["dietary_preferences", "dietary_restrictions"]:
                setattr(guest, "dietary_preferences", value)
                setattr(guest, "dietary_restrictions", value)
            else:
                setattr(guest, field, value)

        db.commit()
        db.refresh(guest)

        resp = GuestResponse.model_validate(guest)
        resp.total_party_count = 1 + guest.plus_ones
        return resp

    @staticmethod
    def delete_guest(db: Session, event_id: str, guest_id: str) -> None:
        guest = GuestService.get_guest(db, event_id, guest_id)
        db.delete(guest)
        db.commit()

    @staticmethod
    def quick_update_rsvp(
        db: Session, event_id: str, guest_id: str, rsvp_status: str
    ) -> GuestResponse:
        guest = GuestService.get_guest(db, event_id, guest_id)
        guest.rsvp_status = rsvp_status.upper()
        db.commit()
        db.refresh(guest)
        resp = GuestResponse.model_validate(guest)
        resp.total_party_count = 1 + guest.plus_ones
        return resp

    @staticmethod
    def quick_update_invitation(
        db: Session, event_id: str, guest_id: str, invitation_status: str
    ) -> GuestResponse:
        guest = GuestService.get_guest(db, event_id, guest_id)
        guest.invitation_status = invitation_status.upper()
        db.commit()
        db.refresh(guest)
        resp = GuestResponse.model_validate(guest)
        resp.total_party_count = 1 + guest.plus_ones
        return resp

