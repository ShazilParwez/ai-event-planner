from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest
from app.models.event import EventType, EventStatus


def test_create_event_success(client):
    payload = {
        "title": "Aarav & Priya's Wedding",
        "event_type": "WEDDING",
        "description": "Grand heritage royal wedding in Udaipur",
        "location": "Udaipur, Rajasthan",
        "start_date": "2026-12-10T10:00:00Z",
        "end_date": "2026-12-12T23:00:00Z",
        "expected_guest_count": 350,
        "target_budget": "3500000.00",
        "currency": "INR",
    }
    response = client.post("/api/v1/events", json=payload)
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["title"] == "Aarav & Priya's Wedding"
    assert data["name"] == "Aarav & Priya's Wedding"
    assert data["event_type"] == "WEDDING"
    assert data["currency"] == "INR"
    assert Decimal(str(data["target_budget"])) == Decimal("3500000.00")
    assert Decimal(str(data["total_budget"])) == Decimal("3500000.00")
    assert data["expected_guest_count"] == 350
    assert data["status"] == "PLANNING"
    assert "id" in data


def test_create_event_currency_validation(client):
    # Valid currencies
    for curr in ["INR", "USD", "EUR", "gbp", "AED"]:
        payload = {
            "title": f"International Event ({curr})",
            "event_type": "COMMUNITY",
            "currency": curr,
        }
        res = client.post("/api/v1/events", json=payload)
        assert res.status_code == 201
        assert res.json()["data"]["currency"] == curr.upper()

    # Invalid currencies
    for bad_curr in ["US", "USDD", "123", "IN$", "EUROPE"]:
        payload = {
            "title": "Invalid Currency Event",
            "event_type": "COMMUNITY",
            "currency": bad_curr,
        }
        res = client.post("/api/v1/events", json=payload)
        assert res.status_code == 422


def test_create_event_date_validation(client):
    # end_date before start_date must be rejected
    payload = {
        "title": "Time Traveler's Gala",
        "event_type": "OTHER",
        "start_date": "2026-12-15T18:00:00Z",
        "end_date": "2026-12-14T18:00:00Z",
    }
    res = client.post("/api/v1/events", json=payload)
    assert res.status_code == 422


def test_create_event_negative_budget_rejected(client):
    payload = {
        "title": "Negative Budget Event",
        "event_type": "BIRTHDAY",
        "target_budget": "-500.00",
    }
    res = client.post("/api/v1/events", json=payload)
    assert res.status_code == 422


def test_get_event_by_id(client):
    # Create an event first
    create_res = client.post(
        "/api/v1/events",
        json={"title": "Tech Community Summit", "event_type": "COMMUNITY", "target_budget": "50000.00"},
    )
    event_id = create_res.json()["data"]["id"]

    # Fetch event
    res = client.get(f"/api/v1/events/{event_id}")
    assert res.status_code == 200
    assert res.json()["data"]["id"] == event_id
    assert res.json()["data"]["title"] == "Tech Community Summit"


def test_get_event_not_found(client):
    res = client.get("/api/v1/events/nonexistent-uuid-1234")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_list_events_and_filtering(client):
    # Create 3 distinct events
    client.post("/api/v1/events", json={"title": "Rohan's 30th Birthday", "event_type": "BIRTHDAY"})
    client.post("/api/v1/events", json={"title": "Community Park Clean-Up", "event_type": "COMMUNITY"})
    client.post("/api/v1/events", json={"title": "Corporate Gala Dinner", "event_type": "OTHER"})

    # List all
    res = client.get("/api/v1/events")
    assert res.status_code == 200
    all_events = res.json()["data"]
    assert len(all_events) >= 3

    # Filter by event_type
    res_bday = client.get("/api/v1/events?event_type=BIRTHDAY")
    assert res_bday.status_code == 200
    for e in res_bday.json()["data"]:
        assert e["event_type"] == "BIRTHDAY"

    # Search filter
    res_search = client.get("/api/v1/events?search=Rohan")
    assert res_search.status_code == 200
    assert any("Rohan" in e["title"] for e in res_search.json()["data"])


def test_list_events_paginated(client):
    res = client.get("/api/v1/events/paginated?page=1&page_size=2")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert len(data["items"]) <= 2


def test_update_event(client):
    create_res = client.post(
        "/api/v1/events",
        json={"title": "Original Birthday Party", "event_type": "BIRTHDAY", "target_budget": "15000.00"},
    )
    event_id = create_res.json()["data"]["id"]

    update_payload = {
        "title": "Updated Super Birthday Bash",
        "target_budget": "25000.00",
        "status": "CONFIRMED",
        "expected_guest_count": 60,
    }
    res = client.put(f"/api/v1/events/{event_id}", json=update_payload)
    assert res.status_code == 200
    updated = res.json()["data"]
    assert updated["title"] == "Updated Super Birthday Bash"
    assert Decimal(str(updated["target_budget"])) == Decimal("25000.00")
    assert updated["status"] == "CONFIRMED"
    assert updated["expected_guest_count"] == 60


def test_delete_event(client):
    create_res = client.post(
        "/api/v1/events",
        json={"title": "Event To Be Deleted", "event_type": "OTHER"},
    )
    event_id = create_res.json()["data"]["id"]

    del_res = client.delete(f"/api/v1/events/{event_id}")
    assert del_res.status_code == 200

    # Verify 404
    fetch_res = client.get(f"/api/v1/events/{event_id}")
    assert fetch_res.status_code == 404

