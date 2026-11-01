from decimal import Decimal
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.event import Event
from app.models.vendor import VendorItem, VendorCategory, VendorStatus
from app.schemas.vendor import (
    VendorItemCreate,
    VendorItemUpdate,
    VendorItemResponse,
    VendorSummaryResponse,
    VendorCategoryResponse,
)
from app.services.event_service import EventService


STANDARD_VENDOR_CATEGORIES = [
    {"name": "Venue", "description": "Banquet halls, heritage palaces, lawns, resorts, and spaces."},
    {"name": "Catering", "description": "Food & beverage catering, live stalls, royal buffet, and bar management."},
    {"name": "Decoration", "description": "Floral styling, Mandap/stage decor, lighting, and theme installations."},
    {"name": "Photography", "description": "Candid & traditional event photography, couple portraits."},
    {"name": "Videography", "description": "Cinematic films, drone footage, live streaming, teasers."},
    {"name": "Entertainment", "description": "DJs, live bands, folk dancers, choreographers, sound systems."},
    {"name": "Transportation", "description": "Vintage bridal cars, luxury guest shuttles, airport transfers."},
    {"name": "Accommodation", "description": "Guest rooms, hotel room blocks, welcome hampers."},
    {"name": "Makeup and Styling", "description": "Bridal artists, groom styling, mehendi artists, draping."},
    {"name": "Printing and Invitations", "description": "Physical cards, digital invites, signage, itinerary booklets."},
    {"name": "Other", "description": "Security, favors, fireworks, and miscellaneous rentals."},
]


class VendorService:
    @staticmethod
    def get_categories(db: Session) -> List[VendorCategory]:
        categories = db.query(VendorCategory).order_by(VendorCategory.name).all()
        if not categories:
            # Seed automatically if empty
            categories = VendorService.seed_categories(db)
        return categories

    @staticmethod
    def seed_categories(db: Session) -> List[VendorCategory]:
        seeded: List[VendorCategory] = []
        for cat_data in STANDARD_VENDOR_CATEGORIES:
            existing = db.query(VendorCategory).filter(VendorCategory.name == cat_data["name"]).first()
            if not existing:
                cat = VendorCategory(name=cat_data["name"], description=cat_data["description"])
                db.add(cat)
                seeded.append(cat)
        db.commit()
        for cat in seeded:
            db.refresh(cat)
        return db.query(VendorCategory).order_by(VendorCategory.name).all()

    @staticmethod
    def get_vendor_summary(
        db: Session,
        event_id: str,
        category: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> VendorSummaryResponse:
        event = EventService.get_event(db, event_id)

        all_items = db.query(VendorItem).filter(VendorItem.event_id == event.id).all()

        # Apply optional filters for items list
        filtered_items = all_items
        if category and category.strip():
            cat_clean = category.strip().lower()
            filtered_items = [v for v in filtered_items if v.category.lower() == cat_clean]
        if status_filter and status_filter.strip():
            status_clean = status_filter.strip().upper()
            filtered_items = [v for v in filtered_items if v.status.upper() == status_clean]

        # Financial Calculations with exact Decimal
        total_vendors = len(all_items)
        booked_vendors = sum(1 for v in all_items if v.status == VendorStatus.BOOKED.value)
        pending_vendors = total_vendors - booked_vendors

        total_quoted_amount = sum(
            (v.estimated_quote or Decimal("0.00")) for v in all_items
        )
        total_agreed_cost = sum(
            (v.final_agreed_price or Decimal("0.00")) for v in all_items
        )
        total_advance_paid = sum(
            (v.advance_paid or Decimal("0.00")) for v in all_items
        )
        total_contracted_spend = sum(
            (v.final_agreed_price or Decimal("0.00")) for v in all_items if v.status == VendorStatus.BOOKED.value
        )
        total_remaining_payment = max(Decimal("0.00"), total_agreed_cost - total_advance_paid)

        item_responses: List[VendorItemResponse] = []
        for v in filtered_items:
            item_resp = VendorItemResponse(
                id=v.id,
                event_id=v.event_id,
                category=v.category,
                name=v.name,
                contact_name=v.contact_name,
                contact_email=v.contact_email,
                contact_phone=v.contact_phone,
                location=v.location,
                website=v.website,
                status=VendorStatus(v.status) if v.status in VendorStatus.__members__ else VendorStatus.DISCOVERING,
                estimated_quote=v.estimated_quote,
                final_agreed_price=v.final_agreed_price,
                advance_paid=v.advance_paid or Decimal("0.00"),
                contract_signed=v.contract_signed,
                notes=v.notes,
                is_ai_suggested_checklist=v.is_ai_suggested_checklist,
                quoted_amount=v.quoted_amount,
                agreed_cost=v.agreed_cost,
                remaining_payment=v.remaining_payment,
                created_at=v.created_at,
                updated_at=v.updated_at,
            )
            item_responses.append(item_resp)

        return VendorSummaryResponse(
            event_id=event.id,
            currency=event.currency or "INR",
            total_vendors=total_vendors,
            booked_vendors=booked_vendors,
            hired_vendors=booked_vendors,
            pending_vendors=pending_vendors,
            total_quoted_amount=total_quoted_amount,
            total_agreed_cost=total_agreed_cost,
            total_advance_paid=total_advance_paid,
            total_remaining_payment=total_remaining_payment,
            total_contracted_spend=total_contracted_spend,
            items=item_responses,
        )

    @staticmethod
    def get_vendor(db: Session, event_id: str, vendor_id: str) -> VendorItem:
        event = EventService.get_event(db, event_id)
        vendor = (
            db.query(VendorItem)
            .filter(VendorItem.id == vendor_id, VendorItem.event_id == event.id)
            .first()
        )
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor item '{vendor_id}' not found for event '{event_id}'.",
            )
        return vendor

    @staticmethod
    def create_vendor(db: Session, event_id: str, item_in: VendorItemCreate) -> VendorItem:
        event = EventService.get_event(db, event_id)

        # Validate advance paid does not exceed cost ceiling
        ceiling = item_in.final_agreed_price if item_in.final_agreed_price is not None else item_in.estimated_quote
        if ceiling is not None and item_in.advance_paid > ceiling:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Advance paid ({item_in.advance_paid}) cannot exceed agreed or quoted cost ({ceiling}).",
            )

        vendor = VendorItem(
            event_id=event.id,
            category=item_in.category,
            name=item_in.name,
            contact_name=item_in.contact_name,
            contact_email=item_in.contact_email,
            contact_phone=item_in.contact_phone,
            location=item_in.location,
            website=item_in.website,
            status=item_in.status.value,
            estimated_quote=item_in.estimated_quote,
            final_agreed_price=item_in.final_agreed_price,
            advance_paid=item_in.advance_paid,
            contract_signed=item_in.contract_signed,
            notes=item_in.notes,
            is_ai_suggested_checklist=item_in.is_ai_suggested_checklist,
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def create_vendor_item(db: Session, event_id: str, item_in: VendorItemCreate) -> VendorItem:
        """Explicit domain method to create a vendor checklist/procurement item for an event."""
        return VendorService.create_vendor(db, event_id, item_in)

    @staticmethod
    def update_vendor(
        db: Session, event_id: str, vendor_id: str, item_in: VendorItemUpdate
    ) -> VendorItem:
        event = EventService.get_event(db, event_id)
        vendor = (
            db.query(VendorItem)
            .filter(VendorItem.id == vendor_id, VendorItem.event_id == event.id)
            .first()
        )
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor item '{vendor_id}' not found for event '{event_id}'.",
            )

        update_data = item_in.model_dump(exclude_unset=True)

        new_advance = update_data.get("advance_paid", vendor.advance_paid)
        new_agreed = update_data.get("final_agreed_price", vendor.final_agreed_price)
        new_quote = update_data.get("estimated_quote", vendor.estimated_quote)

        ceiling = new_agreed if new_agreed is not None else new_quote
        if ceiling is not None and new_advance is not None and new_advance > ceiling:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Advance paid ({new_advance}) cannot exceed agreed or quoted cost ({ceiling}).",
            )

        for field, val in update_data.items():
            if field == "status" and val is not None:
                vendor.status = val.value
            else:
                setattr(vendor, field, val)

        db.commit()
        db.refresh(vendor)
        return vendor

    @staticmethod
    def delete_vendor(db: Session, event_id: str, vendor_id: str) -> None:
        event = EventService.get_event(db, event_id)
        vendor = (
            db.query(VendorItem)
            .filter(VendorItem.id == vendor_id, VendorItem.event_id == event.id)
            .first()
        )
        if not vendor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vendor item '{vendor_id}' not found for event '{event_id}'.",
            )
        db.delete(vendor)
        db.commit()

