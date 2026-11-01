from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.budget import BudgetCategory, BudgetItem, BudgetItemStatus
from app.models.event import Event
from app.schemas.budget import (
    BudgetCategoryCreate,
    BudgetCategoryUpdate,
    BudgetCategoryResponse,
    BudgetItemCreate,
    BudgetItemUpdate,
    BudgetItemResponse,
    BudgetOverviewResponse,
)
from app.core.logging import logger

SUGGESTED_DEFAULT_CATEGORIES = [
    {"name": "Venue", "pct": Decimal("25.00")},
    {"name": "Catering", "pct": Decimal("30.00")},
    {"name": "Decoration", "pct": Decimal("12.00")},
    {"name": "Photography & Videography", "pct": Decimal("12.00")},
    {"name": "Entertainment", "pct": Decimal("8.00")},
    {"name": "Transportation", "pct": Decimal("4.00")},
    {"name": "Accommodation", "pct": Decimal("4.00")},
    {"name": "Invitations & Stationery", "pct": Decimal("2.00")},
    {"name": "Miscellaneous & Contingency", "pct": Decimal("3.00")},
]


class BudgetService:
    """Service providing strictly deterministic mathematical calculations and CRUD for event budgets."""

    @staticmethod
    def calculate_overview(event: Event, db: Session) -> BudgetOverviewResponse:
        """Deterministically aggregates all category allocations, item estimates, actual costs, and payments."""
        categories = (
            db.query(BudgetCategory)
            .filter(BudgetCategory.event_id == event.id)
            .order_by(BudgetCategory.name.asc())
            .all()
        )

        category_responses: List[BudgetCategoryResponse] = []
        total_allocated = Decimal("0.00")
        total_estimated = Decimal("0.00")
        total_actual = Decimal("0.00")
        total_paid = Decimal("0.00")

        for cat in categories:
            cat_estimated = Decimal("0.00")
            cat_actual = Decimal("0.00")
            cat_paid = Decimal("0.00")
            item_responses: List[BudgetItemResponse] = []

            for item in cat.items:
                cat_estimated += item.estimated_cost
                cat_actual += item.actual_cost
                cat_paid += item.paid_amount
                item_responses.append(BudgetItemResponse.model_validate(item))

            total_allocated += cat.allocated_amount
            total_estimated += cat_estimated
            total_actual += cat_actual
            total_paid += cat_paid

            cat_spend = cat_actual if cat_actual > Decimal("0.00") else cat_estimated
            cat_variance = cat.allocated_amount - cat_spend
            utilization = (
                ((cat_actual / cat.allocated_amount) * Decimal("100.00")).quantize(Decimal("0.01"))
                if cat.allocated_amount > Decimal("0.00")
                else Decimal("0.00")
            )

            cat_resp = BudgetCategoryResponse(
                id=cat.id,
                event_id=cat.event_id,
                name=cat.name,
                allocated_amount=cat.allocated_amount,
                percentage_target=cat.percentage_target,
                items=item_responses,
                total_estimated=cat_estimated,
                total_actual=cat_actual,
                total_paid=cat_paid,
                variance=cat_variance,
                utilization_percentage=utilization,
                is_over_allocated=cat_spend > cat.allocated_amount,
            )
            category_responses.append(cat_resp)

        target_budget = event.target_budget
        committed_spend = total_actual if total_actual > Decimal("0.00") else total_estimated
        remaining_budget = target_budget - committed_spend
        variance = target_budget - committed_spend
        is_over_budget = committed_spend > target_budget

        return BudgetOverviewResponse(
            event_id=event.id,
            target_budget=target_budget,
            total_allocated=total_allocated,
            total_estimated=total_estimated,
            total_actual=total_actual,
            total_paid=total_paid,
            remaining_budget=remaining_budget,
            variance=variance,
            is_over_budget=is_over_budget,
            currency=event.currency,
            categories=category_responses,
        )

    # ---------------- Category CRUD ----------------

    @staticmethod
    def list_categories(db: Session, event_id: str) -> List[BudgetCategory]:
        return (
            db.query(BudgetCategory)
            .filter(BudgetCategory.event_id == event_id)
            .order_by(BudgetCategory.name.asc())
            .all()
        )

    @staticmethod
    def get_category(db: Session, event_id: str, category_id: str) -> BudgetCategory:
        cat = (
            db.query(BudgetCategory)
            .filter(BudgetCategory.id == category_id, BudgetCategory.event_id == event_id)
            .first()
        )
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Budget category '{category_id}' not found for event '{event_id}'.",
            )
        return cat

    @staticmethod
    def create_category(db: Session, event_id: str, cat_in: BudgetCategoryCreate) -> BudgetCategory:
        existing = (
            db.query(BudgetCategory)
            .filter(BudgetCategory.event_id == event_id, BudgetCategory.name == cat_in.name.strip())
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Budget category with name '{cat_in.name}' already exists for this event.",
            )

        category = BudgetCategory(
            event_id=event_id,
            name=cat_in.name.strip(),
            allocated_amount=cat_in.allocated_amount,
            percentage_target=cat_in.percentage_target,
        )
        db.add(category)
        db.commit()
        db.refresh(category)
        logger.info(f"Created category '{category.name}' for event {event_id}")
        return category

    @staticmethod
    def update_category(
        db: Session, event_id: str, category_id: str, cat_in: BudgetCategoryUpdate
    ) -> BudgetCategory:
        cat = BudgetService.get_category(db, event_id, category_id)
        update_data = cat_in.model_dump(exclude_unset=True)

        if "name" in update_data and update_data["name"] is not None:
            new_name = update_data["name"].strip()
            existing = (
                db.query(BudgetCategory)
                .filter(
                    BudgetCategory.event_id == event_id,
                    BudgetCategory.name == new_name,
                    BudgetCategory.id != category_id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another budget category with name '{new_name}' already exists.",
                )
            cat.name = new_name

        if "allocated_amount" in update_data and update_data["allocated_amount"] is not None:
            cat.allocated_amount = update_data["allocated_amount"]

        if "percentage_target" in update_data and update_data["percentage_target"] is not None:
            cat.percentage_target = update_data["percentage_target"]

        db.commit()
        db.refresh(cat)
        logger.info(f"Updated category {category_id} ({cat.name})")
        return cat

    @staticmethod
    def delete_category(
        db: Session, event_id: str, category_id: str, force: bool = False
    ) -> None:
        cat = BudgetService.get_category(db, event_id, category_id)
        item_count = db.query(BudgetItem).filter(BudgetItem.category_id == category_id).count()

        if item_count > 0 and not force:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete category '{cat.name}' because it contains {item_count} items. Delete or reassign items first.",
            )

        db.delete(cat)
        db.commit()
        logger.info(f"Deleted category {category_id} from event {event_id}")

    @staticmethod
    def seed_default_categories(db: Session, event: Event) -> List[BudgetCategory]:
        """Seeds standard event budget categories with allocated amounts based on total budget."""
        existing_names = {
            c.name.lower()
            for c in db.query(BudgetCategory).filter(BudgetCategory.event_id == event.id).all()
        }

        created: List[BudgetCategory] = []
        for def_cat in SUGGESTED_DEFAULT_CATEGORIES:
            if def_cat["name"].lower() in existing_names:
                continue

            pct = def_cat["pct"]
            allocated = ((event.target_budget * pct) / Decimal("100.00")).quantize(Decimal("0.01"))
            cat = BudgetCategory(
                event_id=event.id,
                name=def_cat["name"],
                allocated_amount=allocated,
                percentage_target=pct,
            )
            db.add(cat)
            created.append(cat)

        db.commit()
        for cat in created:
            db.refresh(cat)
        logger.info(f"Seeded {len(created)} default categories for event {event.id}")
        return created

    # ---------------- Item CRUD ----------------

    @staticmethod
    def list_items(
        db: Session, event_id: str, category_id: Optional[str] = None
    ) -> List[BudgetItem]:
        query = db.query(BudgetItem).filter(BudgetItem.event_id == event_id)
        if category_id:
            query = query.filter(BudgetItem.category_id == category_id)
        return query.order_by(BudgetItem.created_at.asc()).all()

    @staticmethod
    def get_item(db: Session, item_id: str, event_id: Optional[str] = None) -> BudgetItem:
        query = db.query(BudgetItem).filter(BudgetItem.id == item_id)
        if event_id:
            query = query.filter(BudgetItem.event_id == event_id)
        item = query.first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Budget item '{item_id}' not found.",
            )
        return item

    @staticmethod
    def create_item(db: Session, event_id: str, item_in: BudgetItemCreate) -> BudgetItem:
        # Cross-event isolation check: verify category exists AND belongs to event
        cat = (
            db.query(BudgetCategory)
            .filter(
                BudgetCategory.id == item_in.category_id,
                BudgetCategory.event_id == event_id,
            )
            .first()
        )
        if not cat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category '{item_in.category_id}' does not exist for event '{event_id}'.",
            )

        item = BudgetItem(
            category_id=cat.id,
            event_id=event_id,
            title=item_in.title.strip(),
            estimated_cost=item_in.estimated_cost,
            actual_cost=item_in.actual_cost,
            paid_amount=item_in.paid_amount,
            status=item_in.status.value,
            notes=item_in.notes,
            is_ai_suggested=item_in.is_ai_suggested,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        logger.info(f"Created budget item '{item.title}' in category '{cat.name}'")
        return item

    @staticmethod
    def update_item(
        db: Session, item_id: str, item_in: BudgetItemUpdate, event_id: Optional[str] = None
    ) -> BudgetItem:
        item = BudgetService.get_item(db, item_id, event_id)
        update_data = item_in.model_dump(exclude_unset=True)

        if "category_id" in update_data and update_data["category_id"] is not None:
            new_cat_id = update_data["category_id"]
            # Cross-event isolation check: verify new category belongs to the SAME event
            new_cat = (
                db.query(BudgetCategory)
                .filter(
                    BudgetCategory.id == new_cat_id,
                    BudgetCategory.event_id == item.event_id,
                )
                .first()
            )
            if not new_cat:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Target category '{new_cat_id}' does not belong to event '{item.event_id}'.",
                )
            item.category_id = new_cat.id

        if "title" in update_data and update_data["title"] is not None:
            item.title = update_data["title"].strip()
        if "estimated_cost" in update_data and update_data["estimated_cost"] is not None:
            item.estimated_cost = update_data["estimated_cost"]
        if "actual_cost" in update_data and update_data["actual_cost"] is not None:
            item.actual_cost = update_data["actual_cost"]
        if "paid_amount" in update_data and update_data["paid_amount"] is not None:
            item.paid_amount = update_data["paid_amount"]
        if "status" in update_data and update_data["status"] is not None:
            item.status = update_data["status"].value
        if "notes" in update_data:
            item.notes = update_data["notes"]

        db.commit()
        db.refresh(item)
        logger.info(f"Updated budget item {item.id} ('{item.title}')")
        return item

    @staticmethod
    def delete_item(db: Session, item_id: str, event_id: Optional[str] = None) -> None:
        item = BudgetService.get_item(db, item_id, event_id)
        db.delete(item)
        db.commit()
        logger.info(f"Deleted budget item {item_id}")
