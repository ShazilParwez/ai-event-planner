import pytest
from decimal import Decimal
from pydantic import ValidationError
from app.models.event import EventType
from app.schemas.event import EventCreate
from app.schemas.budget import BudgetItemCreate
from app.schemas.ai import AICopilotEventGenerationRequest


def test_event_create_validation():
    # Valid
    event = EventCreate(
        title="Golden Jubilee",
        event_type=EventType.COMMUNITY,
        target_budget=Decimal("5000.00"),
    )
    assert event.title == "Golden Jubilee"
    assert event.target_budget == Decimal("5000.00")

    # Invalid title (empty string)
    with pytest.raises(ValidationError):
        EventCreate(
            title="",
            event_type=EventType.WEDDING,
            target_budget=Decimal("1000.00"),
        )

    # Invalid negative budget
    with pytest.raises(ValidationError):
        EventCreate(
            title="Valid Title",
            event_type=EventType.BIRTHDAY,
            target_budget=Decimal("-500.00"),
        )


def test_budget_item_create_validation():
    item = BudgetItemCreate(
        category_id="cat-123",
        title="Live Band",
        estimated_cost=Decimal("1200.00"),
    )
    assert item.estimated_cost == Decimal("1200.00")
    assert item.is_ai_suggested is False

