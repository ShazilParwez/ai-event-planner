"""Comprehensive Backend API Verification Suite for Phase 2.1.
Verifies all HTTP endpoints, actual status codes, response envelopes, and schema validations.
"""

from decimal import Decimal
import pytest
from app.models.event import EventType, EventStatus
from app.models.budget import BudgetItemStatus


def test_1_health_and_readiness_endpoints(client):
    """Test 1: Health and readiness endpoints."""
    # Liveness check
    res_liveness = client.get("/api/v1/healthz")
    assert res_liveness.status_code == 200
    data_live = res_liveness.json()
    assert data_live["status"] == "healthy"
    assert data_live["database_connected"] is True
    assert "ai_provider_mode" in data_live
    assert "ai_circuit_breaker" in data_live

    # Readiness check
    res_ready = client.get("/api/v1/readyz")
    assert res_ready.status_code == 200
    data_ready = res_ready.json()
    assert data_ready["status"] == "ready"
    assert data_ready["database_connected"] is True


def test_2_event_lifecycle_and_endpoints(client):
    """Test 2: Create, list, retrieve, update, and delete event."""
    # A. Create Event
    create_payload = {
        "title": "Aarav & Meera's Sangeet & Wedding",
        "event_type": "WEDDING",
        "description": "3-day traditional Punjabi wedding celebrations in Delhi",
        "location": "New Delhi, India",
        "start_date": "2026-11-25T14:00:00Z",
        "end_date": "2026-11-27T23:00:00Z",
        "expected_guest_count": 400,
        "target_budget": "5000000.00",
        "currency": "INR",
        "status": "PLANNING",
    }
    create_res = client.post("/api/v1/events", json=create_payload)
    assert create_res.status_code == 201
    created_envelope = create_res.json()
    assert created_envelope["success"] is True
    assert created_envelope["message"] == "Event created successfully"
    event_data = created_envelope["data"]
    event_id = event_data["id"]
    assert event_data["title"] == "Aarav & Meera's Sangeet & Wedding"
    assert event_data["name"] == "Aarav & Meera's Sangeet & Wedding"
    assert event_data["event_type"] == "WEDDING"
    assert Decimal(str(event_data["target_budget"])) == Decimal("5000000.00")
    assert event_data["currency"] == "INR"
    assert event_data["expected_guest_count"] == 400

    # B. Retrieve Event by ID
    get_res = client.get(f"/api/v1/events/{event_id}")
    assert get_res.status_code == 200
    get_data = get_res.json()["data"]
    assert get_data["id"] == event_id
    assert get_data["location"] == "New Delhi, India"

    # C. List Events with filtering & pagination
    list_res = client.get("/api/v1/events?event_type=WEDDING")
    assert list_res.status_code == 200
    list_data = list_res.json()["data"]
    assert any(e["id"] == event_id for e in list_data)

    # Paginated listing
    page_res = client.get("/api/v1/events/paginated?page=1&page_size=5")
    assert page_res.status_code == 200
    page_data = page_res.json()["data"]
    assert "items" in page_data
    assert page_data["page"] == 1
    assert page_data["total"] >= 1

    # D. Update Event
    update_payload = {
        "title": "Aarav & Meera's Grand Royal Wedding",
        "location": "ITC Maurya, New Delhi",
        "expected_guest_count": 450,
        "target_budget": "5500000.00",
        "status": "CONFIRMED",
    }
    update_res = client.put(f"/api/v1/events/{event_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()["data"]
    assert updated_data["title"] == "Aarav & Meera's Grand Royal Wedding"
    assert updated_data["location"] == "ITC Maurya, New Delhi"
    assert updated_data["expected_guest_count"] == 450
    assert Decimal(str(updated_data["target_budget"])) == Decimal("5500000.00")
    assert updated_data["status"] == "CONFIRMED"

    # E. Delete Event
    del_res = client.delete(f"/api/v1/events/{event_id}")
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Event deleted successfully"

    # Verify 404 after deletion
    get_again = client.get(f"/api/v1/events/{event_id}")
    assert get_again.status_code == 404


def test_3_budget_categories_and_seeding(client):
    """Test 3: Create budget categories, seed default categories, and retrieve categories."""
    # Create event
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Tech Conference 2026", "event_type": "COMMUNITY", "target_budget": "1000000.00", "currency": "INR"},
    )
    event_id = e_res.json()["data"]["id"]

    # Seed default categories
    seed_res = client.post(f"/api/v1/events/{event_id}/budget/categories/seed")
    assert seed_res.status_code == 201
    seed_data = seed_res.json()["data"]
    assert seed_data["created_count"] == 9
    assert len(seed_data["categories"]) == 9

    # List categories
    cats_res = client.get(f"/api/v1/events/{event_id}/budget/categories")
    assert cats_res.status_code == 200
    categories = cats_res.json()["data"]
    assert len(categories) == 9

    # Create an additional custom category
    custom_cat_payload = {
        "name": "Live Streaming & AV",
        "allocated_amount": "80000.00",
        "percentage_target": "8.00",
    }
    cat_create_res = client.post(f"/api/v1/events/{event_id}/budget/categories", json=custom_cat_payload)
    assert cat_create_res.status_code == 201
    custom_cat = cat_create_res.json()["data"]
    assert custom_cat["name"] == "Live Streaming & AV"
    assert Decimal(str(custom_cat["allocated_amount"])) == Decimal("80000.00")

    # Update category
    cat_id = custom_cat["id"]
    cat_update_res = client.put(
        f"/api/v1/events/{event_id}/budget/categories/{cat_id}",
        json={"allocated_amount": "95000.00", "percentage_target": "9.50"},
    )
    assert cat_update_res.status_code == 200
    assert Decimal(str(cat_update_res.json()["data"]["allocated_amount"])) == Decimal("95000.00")

    # Safe delete empty category
    cat_del_res = client.delete(f"/api/v1/events/{event_id}/budget/categories/{cat_id}")
    assert cat_del_res.status_code == 200


def test_4_budget_items_and_overview_calculation(client):
    """Test 4: Create budget items, update, delete, and retrieve budget overview."""
    # Create event
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Riya's 25th Birthday", "event_type": "BIRTHDAY", "target_budget": "200000.00", "currency": "INR"},
    )
    event_id = e_res.json()["data"]["id"]

    # Create category
    cat_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Food & Beverages", "allocated_amount": "100000.00", "percentage_target": "50.00"},
    )
    cat_id = cat_res.json()["data"]["id"]

    # Create Budget Item 1: Custom Birthday Cake
    item1_payload = {
        "category_id": cat_id,
        "title": "Custom Designer Cake",
        "estimated_cost": "8500.00",
        "actual_cost": "9200.00",
        "paid_amount": "9200.00",
        "status": "PAID",
        "notes": "Belgian chocolate truffle with fondant finish",
    }
    item1_res = client.post(f"/api/v1/events/{event_id}/budget/items", json=item1_payload)
    assert item1_res.status_code == 201
    item1 = item1_res.json()["data"]
    item1_id = item1["id"]
    assert item1["title"] == "Custom Designer Cake"
    assert item1["status"] == "PAID"
    assert Decimal(str(item1["actual_cost"])) == Decimal("9200.00")
    assert Decimal(str(item1["paid_amount"])) == Decimal("9200.00")

    # Create Budget Item 2: Buffet Catering
    item2_payload = {
        "category_id": cat_id,
        "title": "Dinner Buffet Package",
        "estimated_cost": "75000.00",
        "actual_cost": "80000.00",
        "paid_amount": "40000.00",
        "status": "PENDING",
        "notes": "50% advance deposit paid",
    }
    item2_res = client.post(f"/api/v1/events/{event_id}/budget/items", json=item2_payload)
    assert item2_res.status_code == 201
    item2_id = item2_res.json()["data"]["id"]

    # Retrieve Budget Overview
    overview_res = client.get(f"/api/v1/events/{event_id}/budget")
    assert overview_res.status_code == 200
    overview = overview_res.json()["data"]

    # Target Budget = 200000.00
    assert Decimal(str(overview["target_budget"])) == Decimal("200000.00")
    # Total Allocated = 100000.00
    assert Decimal(str(overview["total_allocated"])) == Decimal("100000.00")
    # Total Estimated = 8500.00 + 75000.00 = 83500.00
    assert Decimal(str(overview["total_estimated"])) == Decimal("83500.00")
    # Total Actual = 9200.00 + 80000.00 = 89200.00
    assert Decimal(str(overview["total_actual"])) == Decimal("89200.00")
    # Total Paid = 9200.00 + 40000.00 = 49200.00
    assert Decimal(str(overview["total_paid"])) == Decimal("49200.00")
    # Remaining Budget = 200000.00 - 89200.00 = 110800.00
    assert Decimal(str(overview["remaining_budget"])) == Decimal("110800.00")
    # Variance = 200000.00 - 89200.00 = 110800.00
    assert Decimal(str(overview["variance"])) == Decimal("110800.00")
    assert overview["is_over_budget"] is False

    # Update item 2
    update_item_res = client.put(
        f"/api/v1/events/{event_id}/budget/items/{item2_id}",
        json={"paid_amount": "80000.00", "status": "PAID", "notes": "Fully settled"},
    )
    assert update_item_res.status_code == 200
    assert Decimal(str(update_item_res.json()["data"]["paid_amount"])) == Decimal("80000.00")

    # Delete item 1
    del_item_res = client.delete(f"/api/v1/events/{event_id}/budget/items/{item1_id}")
    assert del_item_res.status_code == 200

    # Verify overview re-calculated
    overview_res2 = client.get(f"/api/v1/events/{event_id}/budget")
    overview2 = overview_res2.json()["data"]
    assert Decimal(str(overview2["total_actual"])) == Decimal("80000.00")
    assert Decimal(str(overview2["remaining_budget"])) == Decimal("120000.00")

