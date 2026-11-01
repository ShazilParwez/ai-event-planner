"""Financial Edge-Case Verification Suite.
Verifies strictly deterministic Decimal mathematics, zero budget/expenses,
over-budget triggers, payment validation, and rounding precision.
"""

from decimal import Decimal
import pytest


def test_edge_case_zero_budget_and_zero_expenses(client):
    """Test 1 & 2: Zero budget and zero expenses."""
    res = client.post(
        "/api/v1/events",
        json={"title": "Zero Budget Community Event", "event_type": "COMMUNITY", "target_budget": "0.00"},
    )
    assert res.status_code == 201
    event_id = res.json()["data"]["id"]

    overview_res = client.get(f"/api/v1/events/{event_id}/budget")
    assert overview_res.status_code == 200
    ov = overview_res.json()["data"]

    assert Decimal(str(ov["target_budget"])) == Decimal("0.00")
    assert Decimal(str(ov["total_allocated"])) == Decimal("0.00")
    assert Decimal(str(ov["total_estimated"])) == Decimal("0.00")
    assert Decimal(str(ov["total_actual"])) == Decimal("0.00")
    assert Decimal(str(ov["total_paid"])) == Decimal("0.00")
    assert Decimal(str(ov["remaining_budget"])) == Decimal("0.00")
    assert Decimal(str(ov["variance"])) == Decimal("0.00")
    assert ov["is_over_budget"] is False


def test_edge_case_expenses_exactly_equal_budget(client):
    """Test 3: Expenses exactly equal to target budget."""
    target = Decimal("50000.00")
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Exact Budget Event", "event_type": "BIRTHDAY", "target_budget": str(target)},
    )
    event_id = e_res.json()["data"]["id"]

    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "All Included", "allocated_amount": str(target), "percentage_target": "100.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Full Party Package",
            "estimated_cost": str(target),
            "actual_cost": str(target),
            "paid_amount": str(target),
            "status": "PAID",
        },
    )

    ov = client.get(f"/api/v1/events/{event_id}/budget").json()["data"]
    assert Decimal(str(ov["total_actual"])) == target
    assert Decimal(str(ov["total_paid"])) == target
    assert Decimal(str(ov["remaining_budget"])) == Decimal("0.00")
    assert Decimal(str(ov["variance"])) == Decimal("0.00")
    assert ov["is_over_budget"] is False


def test_edge_case_expenses_exceeding_budget(client):
    """Test 4: Expenses strictly exceeding the budget (over-budget alert threshold)."""
    target = Decimal("100000.00")
    actual = Decimal("105500.75")
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Overrun Event", "event_type": "WEDDING", "target_budget": str(target)},
    )
    event_id = e_res.json()["data"]["id"]

    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Venue", "allocated_amount": str(target), "percentage_target": "100.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Venue Overtime & Surcharge",
            "estimated_cost": str(target),
            "actual_cost": str(actual),
            "paid_amount": "50000.00",
            "status": "PENDING",
        },
    )

    ov = client.get(f"/api/v1/events/{event_id}/budget").json()["data"]
    assert Decimal(str(ov["total_actual"])) == actual
    # remaining_budget = 100000.00 - 105500.75 = -5500.75
    assert Decimal(str(ov["remaining_budget"])) == Decimal("-5500.75")
    assert Decimal(str(ov["variance"])) == Decimal("-5500.75")
    assert ov["is_over_budget"] is True


def test_edge_case_partial_vs_fully_paid_expenses(client):
    """Test 5 & 6: Partial payments and fully paid expenses."""
    e_res = client.post("/api/v1/events", json={"title": "Payment Test Event", "event_type": "OTHER"})
    event_id = e_res.json()["data"]["id"]

    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Vendors", "allocated_amount": "50000.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    # 1. Partial payment: actual 10,000, paid 4,000 (status PENDING)
    item_partial_res = client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Photographer Deposit",
            "estimated_cost": "10000.00",
            "actual_cost": "10000.00",
            "paid_amount": "4000.00",
            "status": "PENDING",
        },
    )
    assert item_partial_res.status_code == 201
    assert item_partial_res.json()["data"]["status"] == "PENDING"

    # 2. Fully paid: actual 15,000, paid 15,000 (status PAID)
    item_full_res = client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "DJ Performance",
            "estimated_cost": "15000.00",
            "actual_cost": "15000.00",
            "paid_amount": "15000.00",
            "status": "PAID",
        },
    )
    assert item_full_res.status_code == 201
    assert item_full_res.json()["data"]["status"] == "PAID"

    ov = client.get(f"/api/v1/events/{event_id}/budget").json()["data"]
    assert Decimal(str(ov["total_actual"])) == Decimal("25000.00")
    assert Decimal(str(ov["total_paid"])) == Decimal("19000.00")


def test_edge_case_decimal_rounding_and_fractional_cents(client):
    """Test 7: Decimal rounding and fractional cents/paisa precision without floating point drift."""
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Rounding Audit Event", "event_type": "OTHER", "target_budget": "100000.00"},
    )
    event_id = e_res.json()["data"]["id"]

    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Split Category", "allocated_amount": "100000.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    # 3 items with fractional values: 33333.33, 33333.33, 33333.34 = exactly 100000.00
    for title, val in [("Split A", "33333.33"), ("Split B", "33333.33"), ("Split C", "33333.34")]:
        client.post(
            f"/api/v1/events/{event_id}/budget/items",
            json={
                "category_id": cat_id,
                "title": title,
                "estimated_cost": val,
                "actual_cost": val,
                "paid_amount": val,
                "status": "PAID",
            },
        )

    ov = client.get(f"/api/v1/events/{event_id}/budget").json()["data"]
    assert Decimal(str(ov["total_actual"])) == Decimal("100000.00")
    assert Decimal(str(ov["total_paid"])) == Decimal("100000.00")
    assert Decimal(str(ov["remaining_budget"])) == Decimal("0.00")
    assert ov["is_over_budget"] is False


def test_edge_case_invalid_financial_inputs_rejected(client):
    """Test 8 & 9: Negative amounts and paid amount exceeding actual cost."""
    e_res = client.post("/api/v1/events", json={"title": "Input Validation Event", "event_type": "OTHER"})
    event_id = e_res.json()["data"]["id"]

    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Valid Cat", "allocated_amount": "50000.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    # Negative target_budget on event creation
    assert client.post("/api/v1/events", json={"title": "Bad", "event_type": "OTHER", "target_budget": "-10.00"}).status_code == 422

    # Negative allocated_amount on category
    assert client.post(f"/api/v1/events/{event_id}/budget/categories", json={"name": "Bad Cat", "allocated_amount": "-100.00"}).status_code == 422

    # Negative percentage_target on category
    assert client.post(f"/api/v1/events/{event_id}/budget/categories", json={"name": "Bad Pct", "percentage_target": "-5.00"}).status_code == 422

    # Negative estimated_cost on item
    assert client.post(f"/api/v1/events/{event_id}/budget/items", json={"category_id": cat_id, "title": "Neg Est", "estimated_cost": "-1.00"}).status_code == 422

    # Negative actual_cost on item
    assert client.post(f"/api/v1/events/{event_id}/budget/items", json={"category_id": cat_id, "title": "Neg Act", "actual_cost": "-1.00"}).status_code == 422

    # Negative paid_amount on item
    assert client.post(f"/api/v1/events/{event_id}/budget/items", json={"category_id": cat_id, "title": "Neg Paid", "paid_amount": "-1.00"}).status_code == 422

    # Paid amount exceeding actual cost (1200 paid on 1000 actual)
    res_overpaid = client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={"category_id": cat_id, "title": "Overpaid", "actual_cost": "1000.00", "paid_amount": "1200.00"},
    )
    assert res_overpaid.status_code == 422

