from typing import List, Optional
from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_active_user, get_event_for_user, verify_event_access
from app.models.event import Event
from app.models.user import User
from app.schemas.common import StandardResponse
from app.schemas.budget import (
    BudgetOverviewResponse,
    BudgetCategoryCreate,
    BudgetCategoryUpdate,
    BudgetCategoryResponse,
    BudgetItemCreate,
    BudgetItemUpdate,
    BudgetItemResponse,
    SeedCategoriesResponse,
)
from app.services.budget_service import BudgetService

router = APIRouter(tags=["Budget Intelligence"])


# ---------------- Budget Overview ----------------

@router.get("/events/{event_id}/budget", response_model=StandardResponse[BudgetOverviewResponse])
def get_event_budget_overview(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[BudgetOverviewResponse]:
    """Retrieves deterministic mathematical breakdown of event budget, allocations, costs, utilization, and variance."""
    overview = BudgetService.calculate_overview(event, db)
    return StandardResponse(data=overview)


# ---------------- Category Endpoints ----------------

@router.get("/events/{event_id}/budget/categories", response_model=StandardResponse[List[BudgetCategoryResponse]])
def list_budget_categories(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[BudgetCategoryResponse]]:
    """Lists all budget categories for a specific event."""
    categories = BudgetService.list_categories(db, event.id)
    return StandardResponse(
        data=[BudgetCategoryResponse.model_validate(c) for c in categories]
    )


@router.post(
    "/events/{event_id}/budget/categories",
    response_model=StandardResponse[BudgetCategoryResponse],
    status_code=status.HTTP_201_CREATED,
)
def add_budget_category(
    cat_in: BudgetCategoryCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[BudgetCategoryResponse]:
    """Creates a new budget category for the specified event."""
    category = BudgetService.create_category(db, event.id, cat_in)
    return StandardResponse(
        message="Budget category created successfully",
        data=BudgetCategoryResponse.model_validate(category),
    )


@router.put("/events/{event_id}/budget/categories/{category_id}", response_model=StandardResponse[BudgetCategoryResponse])
def update_budget_category(
    category_id: str,
    cat_in: BudgetCategoryUpdate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[BudgetCategoryResponse]:
    """Updates an existing budget category."""
    category = BudgetService.update_category(db, event.id, category_id, cat_in)
    return StandardResponse(
        message="Budget category updated successfully",
        data=BudgetCategoryResponse.model_validate(category),
    )


@router.delete("/events/{event_id}/budget/categories/{category_id}", response_model=StandardResponse[None])
def delete_budget_category(
    category_id: str,
    force: bool = Query(default=False, description="Set True to force delete category and all associated items"),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    """Safely deletes a budget category. Rejects deletion if items exist unless force=True."""
    BudgetService.delete_category(db, event.id, category_id, force=force)
    return StandardResponse(message="Budget category deleted successfully")


@router.post(
    "/events/{event_id}/budget/categories/seed",
    response_model=StandardResponse[SeedCategoriesResponse],
    status_code=status.HTTP_201_CREATED,
)
def seed_default_budget_categories(
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[SeedCategoriesResponse]:
    """Seeds suggested industry-standard budget categories calculated against the event's target budget."""
    created = BudgetService.seed_default_categories(db, event)
    return StandardResponse(
        message=f"Seeded {len(created)} budget categories successfully",
        data=SeedCategoriesResponse(
            message=f"Seeded {len(created)} categories",
            created_count=len(created),
            categories=[BudgetCategoryResponse.model_validate(c) for c in created],
        ),
    )


# ---------------- Item Endpoints ----------------

@router.get("/events/{event_id}/budget/items", response_model=StandardResponse[List[BudgetItemResponse]])
def list_budget_items(
    category_id: Optional[str] = Query(default=None),
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[List[BudgetItemResponse]]:
    """Lists budget items for an event, optionally filtered by category."""
    items = BudgetService.list_items(db, event.id, category_id=category_id)
    return StandardResponse(
        data=[BudgetItemResponse.model_validate(i) for i in items]
    )


@router.post(
    "/events/{event_id}/budget/items",
    response_model=StandardResponse[BudgetItemResponse],
    status_code=status.HTTP_201_CREATED,
)
def add_budget_item(
    item_in: BudgetItemCreate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[BudgetItemResponse]:
    """Adds a new budget expense item under an event category with cross-event isolation."""
    item = BudgetService.create_item(db, event.id, item_in)
    return StandardResponse(
        message="Budget item added successfully",
        data=BudgetItemResponse.model_validate(item),
    )


@router.put("/events/{event_id}/budget/items/{item_id}", response_model=StandardResponse[BudgetItemResponse])
def update_event_budget_item(
    item_id: str,
    item_in: BudgetItemUpdate,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[BudgetItemResponse]:
    """Updates a budget item under a specific event."""
    item = BudgetService.update_item(db, item_id, item_in, event_id=event.id)
    return StandardResponse(
        message="Budget item updated successfully",
        data=BudgetItemResponse.model_validate(item),
    )


@router.delete("/events/{event_id}/budget/items/{item_id}", response_model=StandardResponse[None])
def delete_event_budget_item(
    item_id: str,
    event: Event = Depends(get_event_for_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    """Deletes a budget item under a specific event."""
    BudgetService.delete_item(db, item_id, event_id=event.id)
    return StandardResponse(message="Budget item deleted successfully")


# Direct item routes for backward compatibility
@router.put("/budget/items/{item_id}", response_model=StandardResponse[BudgetItemResponse])
def update_budget_item_direct(
    item_id: str,
    item_in: BudgetItemUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[BudgetItemResponse]:
    from app.models.budget import BudgetItem
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Budget item '{item_id}' not found.")
    verify_event_access(db, item.event_id, current_user)
    updated = BudgetService.update_item(db, item_id, item_in)
    return StandardResponse(
        message="Budget item updated successfully",
        data=BudgetItemResponse.model_validate(updated),
    )


@router.delete("/budget/items/{item_id}", response_model=StandardResponse[None])
def delete_budget_item_direct(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> StandardResponse[None]:
    from app.models.budget import BudgetItem
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Budget item '{item_id}' not found.")
    verify_event_access(db, item.event_id, current_user)
    BudgetService.delete_item(db, item_id)
    return StandardResponse(message="Budget item deleted successfully")
