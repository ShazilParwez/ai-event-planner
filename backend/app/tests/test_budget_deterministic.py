from decimal import Decimal
from app.models.event import Event, EventType, EventStatus
from app.models.budget import BudgetCategory, BudgetItem, BudgetItemStatus
from app.services.budget_service import BudgetService


def test_deterministic_budget_calculations(db):
    # 1. Create Event with $10,000 target budget
    event = Event(
        title="Birthday Gala",
        event_type=EventType.BIRTHDAY.value,
        target_budget=Decimal("10000.00"),
        status=EventStatus.PLANNING.value,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # 2. Add Category 1: Catering ($4,000 allocated)
    cat1 = BudgetCategory(
        event_id=event.id,
        name="Catering",
        allocated_amount=Decimal("4000.00"),
        percentage_target=Decimal("40.00"),
    )
    # Add Category 2: Venue ($3,000 allocated)
    cat2 = BudgetCategory(
        event_id=event.id,
        name="Venue",
        allocated_amount=Decimal("3000.00"),
        percentage_target=Decimal("30.00"),
    )
    db.add_all([cat1, cat2])
    db.commit()

    # 3. Add items to Catering:
    # Item 1: estimated $2,500, actual $2,400, paid $1,000
    item1 = BudgetItem(
        category_id=cat1.id,
        event_id=event.id,
        title="Buffet Dinner",
        estimated_cost=Decimal("2500.00"),
        actual_cost=Decimal("2400.00"),
        paid_amount=Decimal("1000.00"),
        status=BudgetItemStatus.PENDING.value,
    )
    # Item 2: estimated $1,000, actual $1,200, paid $1,200
    item2 = BudgetItem(
        category_id=cat1.id,
        event_id=event.id,
        title="Custom Birthday Cake",
        estimated_cost=Decimal("1000.00"),
        actual_cost=Decimal("1200.00"),
        paid_amount=Decimal("1200.00"),
        status=BudgetItemStatus.PAID.value,
    )
    db.add_all([item1, item2])
    db.commit()

    # Calculate deterministic overview
    overview = BudgetService.calculate_overview(event, db)

    # Total allocated = 4000 + 3000 = 7000.00
    assert overview.total_allocated == Decimal("7000.00")
    # Total estimated = 2500 + 1000 = 3500.00
    assert overview.total_estimated == Decimal("3500.00")
    # Total actual = 2400 + 1200 = 3600.00
    assert overview.total_actual == Decimal("3600.00")
    # Total paid = 1000 + 1200 = 2200.00
    assert overview.total_paid == Decimal("2200.00")
    # Remaining budget = 10000 - 3600 = 6400.00
    assert overview.remaining_budget == Decimal("6400.00")
    assert overview.variance == Decimal("6400.00")
    assert overview.is_over_budget is False


def test_budget_over_limit_detection(db):
    event = Event(
        title="Community Fair",
        event_type=EventType.COMMUNITY.value,
        target_budget=Decimal("5000.00"),
        status=EventStatus.PLANNING.value,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    cat = BudgetCategory(
        event_id=event.id,
        name="Logistics",
        allocated_amount=Decimal("5000.00"),
        percentage_target=Decimal("100.00"),
    )
    db.add(cat)
    db.commit()

    # Actual cost exceeds target budget ($5,500 vs $5,000)
    item = BudgetItem(
        category_id=cat.id,
        event_id=event.id,
        title="Heavy Tent Rental",
        estimated_cost=Decimal("4500.00"),
        actual_cost=Decimal("5500.00"),
        paid_amount=Decimal("2000.00"),
    )
    db.add(item)
    db.commit()

    overview = BudgetService.calculate_overview(event, db)
    assert overview.is_over_budget is True
    assert overview.remaining_budget == Decimal("-500.00")
    assert overview.variance == Decimal("-500.00")

