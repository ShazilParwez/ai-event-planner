from decimal import Decimal
import pytest


def test_budget_category_crud_and_safety(client):
    # Create event
    e_res = client.post("/api/v1/events", json={"title": "Anniversary Gala", "event_type": "OTHER", "target_budget": "500000.00"})
    event_id = e_res.json()["data"]["id"]

    # 1. Create Category
    cat_payload = {
        "name": "Luxury Catering",
        "allocated_amount": "200000.00",
        "percentage_target": "40.00",
    }
    c_res = client.post(f"/api/v1/events/{event_id}/budget/categories", json=cat_payload)
    assert c_res.status_code == 201
    cat_id = c_res.json()["data"]["id"]
    assert c_res.json()["data"]["name"] == "Luxury Catering"
    assert Decimal(str(c_res.json()["data"]["allocated_amount"])) == Decimal("200000.00")

    # 2. Prevent duplicate category names within same event
    dup_res = client.post(f"/api/v1/events/{event_id}/budget/categories", json=cat_payload)
    assert dup_res.status_code == 400

    # 3. Update Category
    u_res = client.put(
        f"/api/v1/events/{event_id}/budget/categories/{cat_id}",
        json={"allocated_amount": "220000.00", "percentage_target": "44.00"},
    )
    assert u_res.status_code == 200
    assert Decimal(str(u_res.json()["data"]["allocated_amount"])) == Decimal("220000.00")

    # 4. Add an item into category
    item_payload = {
        "category_id": cat_id,
        "title": "Chef Tasting Menu",
        "estimated_cost": "150000.00",
        "actual_cost": "160000.00",
        "paid_amount": "50000.00",
    }
    item_res = client.post(f"/api/v1/events/{event_id}/budget/items", json=item_payload)
    assert item_res.status_code == 201

    # 5. Attempt safe delete category (should be blocked because it has items)
    del_blocked = client.delete(f"/api/v1/events/{event_id}/budget/categories/{cat_id}")
    assert del_blocked.status_code == 400
    assert "contains" in del_blocked.json()["detail"].lower()

    # 6. Force delete category
    del_forced = client.delete(f"/api/v1/events/{event_id}/budget/categories/{cat_id}?force=true")
    assert del_forced.status_code == 200


def test_seed_default_categories(client):
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Community Music Festival", "event_type": "COMMUNITY", "target_budget": "100000.00"},
    )
    event_id = e_res.json()["data"]["id"]

    seed_res = client.post(f"/api/v1/events/{event_id}/budget/categories/seed")
    assert seed_res.status_code == 201
    data = seed_res.json()["data"]
    assert data["created_count"] == 9

    # Fetch budget overview to verify categories
    b_res = client.get(f"/api/v1/events/{event_id}/budget")
    assert b_res.status_code == 200
    overview = b_res.json()["data"]
    assert len(overview["categories"]) == 9
    assert Decimal(str(overview["total_allocated"])) == Decimal("100000.00")


def test_budget_item_cross_event_isolation(client):
    # Event 1
    e1_res = client.post("/api/v1/events", json={"title": "Event Alpha", "event_type": "WEDDING"})
    event_id_1 = e1_res.json()["data"]["id"]
    c1_res = client.post(
        f"/api/v1/events/{event_id_1}/budget/categories",
        json={"name": "Alpha Venue", "allocated_amount": "10000.00"},
    )
    cat_id_1 = c1_res.json()["data"]["id"]

    # Event 2
    e2_res = client.post("/api/v1/events", json={"title": "Event Beta", "event_type": "BIRTHDAY"})
    event_id_2 = e2_res.json()["data"]["id"]

    # Attempt to create an item in Event 2 using Category from Event 1 (must fail)
    cross_post = client.post(
        f"/api/v1/events/{event_id_2}/budget/items",
        json={"category_id": cat_id_1, "title": "Sneaky Cross-Event Item", "estimated_cost": "5000.00"},
    )
    assert cross_post.status_code == 400
    assert "does not exist for event" in cross_post.json()["detail"].lower()


def test_budget_financial_validations(client):
    e_res = client.post("/api/v1/events", json={"title": "Validation Event", "event_type": "OTHER"})
    event_id = e_res.json()["data"]["id"]
    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "General", "allocated_amount": "10000.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    # Negative costs must be rejected by Pydantic
    res_neg_est = client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={"category_id": cat_id, "title": "Negative Est", "estimated_cost": "-10.00"},
    )
    assert res_neg_est.status_code == 422

    res_neg_act = client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={"category_id": cat_id, "title": "Negative Act", "actual_cost": "-50.00"},
    )
    assert res_neg_act.status_code == 422

    # Paid amount cannot exceed actual cost
    res_overpaid = client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Overpaid Item",
            "estimated_cost": "100.00",
            "actual_cost": "100.00",
            "paid_amount": "150.00",
        },
    )
    assert res_overpaid.status_code == 422


def test_deterministic_decimal_precision_and_over_budget(client):
    # Event with target budget 10,000.00 INR
    e_res = client.post(
        "/api/v1/events",
        json={"title": "Precision Event", "event_type": "WEDDING", "target_budget": "10000.00", "currency": "INR"},
    )
    event_id = e_res.json()["data"]["id"]

    c_res = client.post(
        f"/api/v1/events/{event_id}/budget/categories",
        json={"name": "Decor", "allocated_amount": "5000.00", "percentage_target": "50.00"},
    )
    cat_id = c_res.json()["data"]["id"]

    # Add items with exact paisa/cents fractions: 1234.56 and 3765.44 (Sum = 5000.00)
    client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Flowers",
            "estimated_cost": "1234.56",
            "actual_cost": "1234.56",
            "paid_amount": "1234.56",
        },
    )
    client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Drapes",
            "estimated_cost": "3765.44",
            "actual_cost": "3765.44",
            "paid_amount": "3000.00",
        },
    )

    overview = client.get(f"/api/v1/events/{event_id}/budget").json()["data"]
    assert Decimal(str(overview["total_estimated"])) == Decimal("5000.00")
    assert Decimal(str(overview["total_actual"])) == Decimal("5000.00")
    assert Decimal(str(overview["total_paid"])) == Decimal("4234.56")
    assert Decimal(str(overview["remaining_budget"])) == Decimal("5000.00")
    assert overview["is_over_budget"] is False

    # Now add an item that pushes committed spend over the 10,000.00 target budget
    client.post(
        f"/api/v1/events/{event_id}/budget/items",
        json={
            "category_id": cat_id,
            "title": "Golden Chandelier",
            "estimated_cost": "6000.00",
            "actual_cost": "6000.00",
            "paid_amount": "6000.00",
        },
    )

    overview_after = client.get(f"/api/v1/events/{event_id}/budget").json()["data"]
    # Total actual = 5000.00 + 6000.00 = 11000.00 > 10000.00
    assert Decimal(str(overview_after["total_actual"])) == Decimal("11000.00")
    assert Decimal(str(overview_after["remaining_budget"])) == Decimal("-1000.00")
    assert overview_after["is_over_budget"] is True

