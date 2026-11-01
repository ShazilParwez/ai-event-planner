import pytest
from pydantic import ValidationError
from fastapi import status
from app.models.guest import RSVPStatus, GuestCategory, InvitationStatus
from app.schemas.guest import GuestCreate, GuestUpdate
from app.schemas.inspiration import InspirationCardCreate, InspirationCardUpdate, InspirationGenerateRequest
from app.services.ai.fallback import generate_fallback_inspiration
from app.models.event import EventType


@pytest.fixture
def sample_event_id(client):
    res = client.post(
        "/api/v1/events",
        json={
            "title": "Rajesh & Priya Grand Wedding",
            "event_type": "WEDDING",
            "target_budget": "2500000.00",
            "expected_guest_count": 250,
            "currency": "INR",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    return res.json()["data"]["id"]


@pytest.fixture
def second_event_id(client):
    res = client.post(
        "/api/v1/events",
        json={
            "title": "Ananya 30th Birthday Gala",
            "event_type": "BIRTHDAY",
            "target_budget": "300000.00",
            "expected_guest_count": 50,
            "currency": "INR",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    return res.json()["data"]["id"]


def test_guest_crud_and_party_count(client, sample_event_id):
    # 1. Create Guest
    create_payload = {
        "name": "Vikramaditya Singhania",
        "email": "vikram@example.com",
        "phone": "+91 98765 43210",
        "category": "VIP",
        "rsvp_status": "CONFIRMED",
        "invitation_status": "SENT",
        "plus_ones": 2,
        "dietary_preferences": "Vegetarian, Jain",
        "accessibility_requirements": "Wheelchair access for banquet hall",
        "table_assignment": "Table Royal 1",
        "notes": "Close family friend of the groom",
    }
    res = client.post(f"/api/v1/events/{sample_event_id}/guests", json=create_payload)
    assert res.status_code == status.HTTP_201_CREATED
    guest = res.json()["data"]
    guest_id = guest["id"]
    assert guest["name"] == "Vikramaditya Singhania"
    assert guest["category"] == "VIP"
    assert guest["rsvp_status"] == "CONFIRMED"
    assert guest["plus_ones"] == 2
    assert guest["total_party_count"] == 3  # 1 guest + 2 plus ones

    # 2. Retrieve Single Guest
    res = client.get(f"/api/v1/events/{sample_event_id}/guests/{guest_id}")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["email"] == "vikram@example.com"

    # 3. Update Guest
    update_payload = {
        "plus_ones": 3,
        "table_assignment": "Table Royal Presidential",
    }
    res = client.put(f"/api/v1/events/{sample_event_id}/guests/{guest_id}", json=update_payload)
    assert res.status_code == status.HTTP_200_OK
    updated = res.json()["data"]
    assert updated["plus_ones"] == 3
    assert updated["total_party_count"] == 4
    assert updated["table_assignment"] == "Table Royal Presidential"

    # 4. Delete Guest
    res = client.delete(f"/api/v1/events/{sample_event_id}/guests/{guest_id}")
    assert res.status_code == status.HTTP_200_OK

    # 5. Verify 404 after deletion
    res = client.get(f"/api/v1/events/{sample_event_id}/guests/{guest_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_guest_rsvp_transitions_and_quick_patch(client, sample_event_id):
    res = client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={"name": "Aarav Sharma", "category": "Family", "rsvp_status": "INVITED"},
    )
    assert res.status_code == status.HTTP_201_CREATED
    guest_id = res.json()["data"]["id"]

    # Transition to CONFIRMED
    res = client.patch(
        f"/api/v1/events/{sample_event_id}/guests/{guest_id}/rsvp",
        json={"rsvp_status": "CONFIRMED"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["rsvp_status"] == "CONFIRMED"

    # Transition to MAYBE
    res = client.patch(
        f"/api/v1/events/{sample_event_id}/guests/{guest_id}/rsvp",
        json={"rsvp_status": "MAYBE"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["rsvp_status"] == "MAYBE"

    # Transition to DECLINED
    res = client.patch(
        f"/api/v1/events/{sample_event_id}/guests/{guest_id}/rsvp",
        json={"rsvp_status": "DECLINED"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["rsvp_status"] == "DECLINED"


def test_guest_search_filter_and_pagination(client, sample_event_id):
    # Add multiple diverse guests
    guests_data = [
        {"name": "Siddharth Verma", "email": "sid@verma.com", "category": "Colleagues", "rsvp_status": "CONFIRMED"},
        {"name": "Meera Patel", "email": "meera@patel.com", "category": "Family", "rsvp_status": "CONFIRMED"},
        {"name": "Karan Johar", "email": "karan@bollywood.com", "category": "VIP", "rsvp_status": "INVITED"},
        {"name": "Rohan Mehra", "email": "rohan@mehra.com", "category": "Friends", "rsvp_status": "DECLINED"},
        {"name": "Pooja Hegde", "email": "pooja@hegde.com", "category": "VIP", "rsvp_status": "MAYBE"},
    ]
    for g in guests_data:
        client.post(f"/api/v1/events/{sample_event_id}/guests", json=g)

    # Search by query
    res = client.get(f"/api/v1/events/{sample_event_id}/guests?search=verma")
    assert res.status_code == status.HTTP_200_OK
    items = res.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Siddharth Verma"

    # Filter by category
    res = client.get(f"/api/v1/events/{sample_event_id}/guests?category=VIP")
    assert res.status_code == status.HTTP_200_OK
    items = res.json()["data"]["items"]
    assert len(items) == 2
    assert all(i["category"] == "VIP" for i in items)

    # Filter by RSVP status
    res = client.get(f"/api/v1/events/{sample_event_id}/guests?rsvp_status=CONFIRMED")
    assert res.status_code == status.HTTP_200_OK
    items = res.json()["data"]["items"]
    assert len(items) >= 2
    assert all(i["rsvp_status"] == "CONFIRMED" for i in items)

    # Pagination
    res = client.get(f"/api/v1/events/{sample_event_id}/guests?page=1&page_size=2")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()["data"]
    assert len(data["items"]) == 2
    assert data["total"] >= 5
    assert data["total_pages"] >= 3


def test_deterministic_guest_analytics_and_dietary_breakdown(client, sample_event_id):
    # Setup controlled dataset
    client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={
            "name": "Host 1",
            "category": "Family",
            "rsvp_status": "CONFIRMED",
            "invitation_status": "SENT",
            "plus_ones": 2,
            "dietary_preferences": "Vegetarian",
        },
    )
    client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={
            "name": "Host 2",
            "category": "Family",
            "rsvp_status": "CONFIRMED",
            "invitation_status": "SENT",
            "plus_ones": 1,
            "dietary_preferences": "Vegetarian, Gluten-Free",
        },
    )
    client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={
            "name": "Declined Guest",
            "category": "Colleagues",
            "rsvp_status": "DECLINED",
            "invitation_status": "SENT",
            "plus_ones": 1,
        },
    )
    client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={
            "name": "Maybe Guest",
            "category": "Friends",
            "rsvp_status": "MAYBE",
            "invitation_status": "SENT",
            "plus_ones": 0,
            "dietary_preferences": "Vegan",
        },
    )
    client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={
            "name": "Uninvited Guest",
            "category": "Other",
            "rsvp_status": "WAITING",
            "invitation_status": "NOT_SENT",
            "plus_ones": 0,
        },
    )

    res = client.get(f"/api/v1/events/{sample_event_id}/guests/analytics")
    assert res.status_code == status.HTTP_200_OK
    analytics = res.json()["data"]

    # Arithmetic checks
    assert analytics["confirmed_guests"] == 2
    assert analytics["declined_guests"] == 1
    assert analytics["maybe_responses"] == 1
    assert analytics["pending_responses"] == 1
    assert analytics["confirmed_plus_ones"] == 3  # 2 + 1
    assert analytics["total_plus_ones"] == 4      # 2 + 1 + 1 + 0 + 0
    # Expected attendance: 2 confirmed + 3 plus_ones = 5
    assert analytics["expected_attendance"] == 5

    # Dietary breakdown
    dietary = analytics["dietary_preference_distribution"]
    assert dietary.get("Vegetarian") == 2
    assert dietary.get("Gluten-Free") == 1
    assert dietary.get("Vegan") == 1

    # Category breakdown
    cats = analytics["guest_category_distribution"]
    assert cats.get("Family") == 2
    assert cats.get("Colleagues") == 1
    assert cats.get("Friends") == 1


def test_guest_cross_event_isolation(client, sample_event_id, second_event_id):
    # Create guest in event 1
    res = client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={"name": "Event 1 Exclusive Guest", "category": "VIP"},
    )
    assert res.status_code == status.HTTP_201_CREATED
    guest_id = res.json()["data"]["id"]

    # Attempt to access or delete from event 2
    res = client.get(f"/api/v1/events/{second_event_id}/guests/{guest_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND

    res = client.put(
        f"/api/v1/events/{second_event_id}/guests/{guest_id}",
        json={"name": "Hijacked Guest Name"},
    )
    assert res.status_code == status.HTTP_404_NOT_FOUND

    res = client.delete(f"/api/v1/events/{second_event_id}/guests/{guest_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_inspiration_card_crud_and_palette(client, sample_event_id):
    card_payload = {
        "title": "Royal Rajwada Stage with Brass Urlis",
        "category": "Decorations",
        "description": "Ornate carved wooden jharokha backdrop illuminated by antique brass hanging lamps and cascading fresh tube roses.",
        "tags": "stage,decor,royal,heritage",
        "color_palette": ["#FF9933", "#D4AF37", "#800020", "#FFFDD0"],
        "suggested_budget_range": "₹1,50,000 - ₹2,50,000 (Indicative)",
        "notes": "Coordinate with Palace venue team on electrical load for chandeliers.",
        "is_saved": True,
        "source_type": "USER",
    }
    # 1. Create card
    res = client.post(f"/api/v1/events/{sample_event_id}/inspiration/cards", json=card_payload)
    assert res.status_code == status.HTTP_201_CREATED
    card = res.json()["data"]
    card_id = card["id"]
    assert card["title"] == "Royal Rajwada Stage with Brass Urlis"
    assert card["color_palette"] == ["#FF9933", "#D4AF37", "#800020", "#FFFDD0"]
    assert card["source_type"] == "USER"
    assert card["is_saved"] is True

    # 2. Retrieve single card
    res = client.get(f"/api/v1/events/{sample_event_id}/inspiration/cards/{card_id}")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["category"] == "Decorations"

    # 3. Update card
    update_payload = {
        "title": "Royal Rajwada Stage & Sangeet Lounge",
        "suggested_budget_range": "₹1,80,000 - ₹2,80,000 (Indicative)",
    }
    res = client.put(f"/api/v1/events/{sample_event_id}/inspiration/cards/{card_id}", json=update_payload)
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["title"] == "Royal Rajwada Stage & Sangeet Lounge"

    # 4. Toggle save status
    res = client.patch(f"/api/v1/events/{sample_event_id}/inspiration/cards/{card_id}/toggle-save")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["is_saved"] is False

    res = client.patch(f"/api/v1/events/{sample_event_id}/inspiration/cards/{card_id}/toggle-save")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["data"]["is_saved"] is True

    # 5. Delete card
    res = client.delete(f"/api/v1/events/{sample_event_id}/inspiration/cards/{card_id}")
    assert res.status_code == status.HTTP_200_OK

    res = client.get(f"/api/v1/events/{sample_event_id}/inspiration/cards/{card_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_inspiration_category_filtering(client, sample_event_id):
    client.post(
        f"/api/v1/events/{sample_event_id}/inspiration/cards",
        json={
            "title": "Marigold & Mirror Decor",
            "category": "Decorations",
            "description": "Fresh marigold strings with miniature mirror hangings.",
        },
    )
    client.post(
        f"/api/v1/events/{sample_event_id}/inspiration/cards",
        json={
            "title": "Sufi Rock Fusion Night",
            "category": "Entertainment",
            "description": "Acoustic sufi ensemble for sangeet evening.",
        },
    )

    # Filter for Decorations
    res = client.get(f"/api/v1/events/{sample_event_id}/inspiration?category=Decorations")
    assert res.status_code == status.HTTP_200_OK
    cards = res.json()["data"]
    assert len(cards) >= 1
    assert all("decor" in c["category"].lower() for c in cards)


def test_inspiration_ai_generation_and_review_before_saving(client, sample_event_id):
    # Generation should return creative candidate ideas without immediately persisting them
    gen_req = {
        "event_id": sample_event_id,
        "category": "Decorations",
        "custom_prompt": "Royal Rajasthani Palace Theme",
        "num_ideas": 3,
    }
    res = client.post(f"/api/v1/events/{sample_event_id}/inspiration/generate", json=gen_req)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()["data"]
    assert "ideas" in data
    assert len(data["ideas"]) > 0
    assert "disclaimer" in data
    assert "indicative" in data["disclaimer"].lower()

    # Verify candidate idea properties
    first_idea = data["ideas"][0]
    assert "title" in first_idea
    assert "description" in first_idea
    assert "color_palette" in first_idea
    assert len(first_idea["color_palette"]) > 0
    assert first_idea["source_type"] == "AI_GENERATED"

    # User explicitly saves one of the generated ideas
    save_res = client.post(
        f"/api/v1/events/{sample_event_id}/inspiration/cards",
        json={
            "title": first_idea["title"],
            "category": first_idea["category"],
            "description": first_idea["description"],
            "color_palette": first_idea["color_palette"],
            "suggested_budget_range": first_idea["suggested_budget_range"],
            "source_type": "AI_GENERATED",
            "is_saved": True,
        },
    )
    assert save_res.status_code == status.HTTP_201_CREATED
    saved_card = save_res.json()["data"]
    assert saved_card["title"] == first_idea["title"]
    assert saved_card["is_saved"] is True


def test_inspiration_cross_event_isolation(client, sample_event_id, second_event_id):
    res = client.post(
        f"/api/v1/events/{sample_event_id}/inspiration/cards",
        json={"title": "Private Palace Idea", "category": "Decorations", "description": "Exclusive to event 1"},
    )
    card_id = res.json()["data"]["id"]

    res = client.get(f"/api/v1/events/{second_event_id}/inspiration/cards/{card_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND

    res = client.delete(f"/api/v1/events/{second_event_id}/inspiration/cards/{card_id}")
    assert res.status_code == status.HTTP_404_NOT_FOUND


def test_guest_and_inspiration_invalid_inputs(client, sample_event_id):
    # 1. Negative plus-ones
    res = client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={"name": "Bad Plus One", "plus_ones": -2},
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 2. Empty guest name
    res = client.post(
        f"/api/v1/events/{sample_event_id}/guests",
        json={"name": "", "category": "Friends"},
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # 3. Missing inspiration title or description
    res = client.post(
        f"/api/v1/events/{sample_event_id}/inspiration/cards",
        json={"title": "", "category": "Decorations", "description": ""},
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_fallback_inspiration_structure():
    ideas = generate_fallback_inspiration(EventType.WEDDING, "Royal Heritage")
    assert len(ideas) >= 3
    for idea in ideas:
        assert idea.title
        assert idea.description
        assert len(idea.color_palette) >= 3
        assert idea.suggested_budget_range is not None
        assert "Indicative" in idea.suggested_budget_range

