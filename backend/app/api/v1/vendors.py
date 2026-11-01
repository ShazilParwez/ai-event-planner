from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException, Query
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
from app.schemas.vendor import (
    VendorItemCreate,
    VendorItemUpdate,
    VendorItemResponse,
    VendorSummaryResponse,
    VendorCategoryResponse,
)
from app.services.vendor_service import VendorService

router = APIRouter(tags=["Vendor Management"])


@router.get("/vendors/categories", response_model=StandardResponse[List[VendorCategoryResponse]])
def get_vendor_categories(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[VendorCategoryResponse]]:
    categories = VendorService.get_categories(db)
    return StandardResponse(
        data=[VendorCategoryResponse.model_validate(c) for c in categories]
    )


@router.post(
    "/vendors/categories/seed",
    response_model=StandardResponse[List[VendorCategoryResponse]],
    status_code=status.HTTP_201_CREATED,
)
def seed_vendor_categories(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[VendorCategoryResponse]]:
    categories = VendorService.seed_categories(db)
    return StandardResponse(
        message=f"Seeded {len(categories)} vendor categories",
        data=[VendorCategoryResponse.model_validate(c) for c in categories],
    )


@router.get("/events/{event_id}/vendors", response_model=StandardResponse[VendorSummaryResponse])
def get_event_vendors(
    category: Optional[str] = Query(default=None, description="Filter by category"),
    status: Optional[str] = Query(default=None, description="Filter by booking status"),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[VendorSummaryResponse]:
    summary = VendorService.get_vendor_summary(db, event.id, category=category, status_filter=status)
    return StandardResponse(data=summary)


@router.get(
    "/events/{event_id}/vendors/{vendor_id}",
    response_model=StandardResponse[VendorItemResponse],
)
@router.get(
    "/vendors/{vendor_id}",
    response_model=StandardResponse[VendorItemResponse],
)
def get_vendor_item(
    vendor_id: str,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[VendorItemResponse]:
    if not event_id:
        from app.models.vendor import VendorItem
        item = db.query(VendorItem).filter(VendorItem.id == vendor_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Vendor item not found.")
        event_id = item.event_id

    verify_event_access(db, event_id, current_user)
    vendor = VendorService.get_vendor(db, event_id, vendor_id)
    return StandardResponse(data=VendorItemResponse.model_validate(vendor))


@router.post(
    "/events/{event_id}/vendors",
    response_model=StandardResponse[VendorItemResponse],
    status_code=status.HTTP_201_CREATED,
)
def add_vendor_item(
    item_in: VendorItemCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[VendorItemResponse]:
    vendor = VendorService.create_vendor(db, event.id, item_in)
    return StandardResponse(
        message="Vendor item added successfully",
        data=VendorItemResponse.model_validate(vendor),
    )


@router.put(
    "/events/{event_id}/vendors/{vendor_id}",
    response_model=StandardResponse[VendorItemResponse],
)
@router.put(
    "/vendors/{vendor_id}",
    response_model=StandardResponse[VendorItemResponse],
)
def update_vendor_item(
    vendor_id: str,
    item_in: VendorItemUpdate,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[VendorItemResponse]:
    if not event_id:
        from app.models.vendor import VendorItem
        item = db.query(VendorItem).filter(VendorItem.id == vendor_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Vendor item not found.")
        event_id = item.event_id

    verify_event_access(db, event_id, current_user)
    vendor = VendorService.update_vendor(db, event_id, vendor_id, item_in)
    return StandardResponse(
        message="Vendor item updated successfully",
        data=VendorItemResponse.model_validate(vendor),
    )


@router.delete(
    "/events/{event_id}/vendors/{vendor_id}",
    response_model=StandardResponse[None],
)
@router.delete(
    "/vendors/{vendor_id}",
    response_model=StandardResponse[None],
)
def delete_vendor_item(
    vendor_id: str,
    event_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    if not event_id:
        from app.models.vendor import VendorItem
        item = db.query(VendorItem).filter(VendorItem.id == vendor_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Vendor item not found.")
        event_id = item.event_id

    verify_event_access(db, event_id, current_user)
    VendorService.delete_vendor(db, event_id, vendor_id)
    return StandardResponse(message="Vendor item deleted successfully")
