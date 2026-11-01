import uuid
from datetime import datetime, timezone, timedelta
from fastapi import status
from sqlalchemy.orm import Session

from app.models.event import Event, EventType, EventStatus
from app.models.guest import Guest
from app.models.timeline import TimelineActivity
from app.models.accessibility import EventAccessibility, VerificationStatus, ConfidenceLevel
from app.schemas.accessibility import AccessibilityProfileInput, VenueAccessibilityInput, VenueRoutesInput, EmergencySupportInput


def test_accessibility_profile_default_seeding(client, db: Session, default_user):
    """Verifies default accessibility profile seeding when querying a fresh event."""
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Spring Charity Gala",
        event_type=EventType.COMMUNITY.value,
        target_budget=50000.0,
    )
    db.add(event)
    db.commit()

    res = client.get(f"/api/v1/events/{event.id}/accessibility")
    assert res.status_code == status.HTTP_200_OK

    data = res.json()["data"]
    assert data["event_id"] == event.id
    assert "profile" in data
    assert "facilities" in data
    assert "routes" in data
    assert "emergency" in data
    assert data["coverage_score"] >= 0.0
    assert data["confidence_level"] == ConfidenceLevel.LOW.value

    # Check that standard facilities are seeded
    facilities = data["facilities"]
    assert "accessible_restrooms" in facilities
    assert "wheelchair_entrances" in facilities
    assert "ramps_and_elevators" in facilities
    assert "quiet_rooms" in facilities
    assert "first_aid" in facilities
    assert facilities["wheelchair_entrances"]["status"] == VerificationStatus.UNVERIFIED.value


def test_update_accessibility_profile_and_score(client, db: Session, default_user):
    """Verifies updating accessibility requirements recalculates coverage score."""
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Tech Leadership Summit",
        event_type=EventType.OTHER.value,
        target_budget=80000.0,
    )
    db.add(event)
    db.commit()

    update_payload = {
        "mobility_assistance": True,
        "wheelchair_accessibility": True,
        "visual_impairment": False,
        "hearing_impairment": True,
        "cognitive_accessibility": False,
        "dyslexia_friendly": True,
        "sensory_sensitivities": True,
        "language_assistance": False,
        "other_requirements": ["Quiet prayer/meditation space"],
        "additional_notes": "VIP attendee uses a motorized wheelchair (width 29 in).",
    }

    res = client.put(f"/api/v1/events/{event.id}/accessibility/profile", json=update_payload)
    assert res.status_code == status.HTTP_200_OK

    data = res.json()["data"]
    profile = data["profile"]
    assert profile["wheelchair_accessibility"] is True
    assert profile["hearing_impairment"] is True
    assert profile["sensory_sensitivities"] is True
    assert profile["additional_notes"] == "VIP attendee uses a motorized wheelchair (width 29 in)."
    assert "Quiet prayer/meditation space" in profile["other_requirements"]


def test_update_venue_facilities_verification(client, db: Session, default_user):
    """Verifies venue facilities updates, verified timestamping, and confidence level promotion."""
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Royal Wedding Celebration",
        event_type=EventType.WEDDING.value,
        target_budget=250000.0,
    )
    db.add(event)
    db.commit()

    venue_payload = {
        "facilities": {
            "wheelchair_entrances": {
                "status": "VERIFIED",
                "notes": "Main glass doors have automatic push-pad and 36-inch clearance.",
            },
            "accessible_restrooms": {
                "status": "VERIFIED",
                "notes": "Two ADA-compliant unisex restrooms on ground level.",
            },
            "ramps_and_elevators": {
                "status": "VERIFIED",
                "notes": "Elevator inspected and certified October 2026.",
            },
            "quiet_rooms": {
                "status": "VERIFIED",
                "notes": "Boardroom B reserved for sensory decompression.",
            },
            "first_aid": {
                "status": "VERIFIED",
                "notes": "AED on site; certified first responder present.",
            },
            "reserved_seating": {
                "status": "VERIFIED",
                "notes": "Front row companion seats designated.",
            },
        },
        "routes": {
            "step_free_access": True,
            "wheelchair_routes": "Step-free from main entrance through foyer to ballroom.",
            "elevator_details": "Passes directly to mezzanine level with voice floor announcements.",
            "verification_status": "VERIFIED",
        },
        "emergency": {
            "emergency_contact_phone": "+91 98765 43210",
            "venue_assistance_phone": "+91 98765 00001",
            "evacuation_procedure": "Ground-floor direct egress via North and East emergency exits.",
            "assembly_point": "Courtyard lawn adjacent to flagpole.",
            "verification_status": "VERIFIED",
        },
    }

    res = client.put(f"/api/v1/events/{event.id}/accessibility/venue", json=venue_payload)
    assert res.status_code == status.HTTP_200_OK

    data = res.json()["data"]
    facilities = data["facilities"]
    assert facilities["wheelchair_entrances"]["status"] == "VERIFIED"
    assert facilities["wheelchair_entrances"]["verified_at"] is not None
    assert data["routes"]["step_free_access"] is True
    assert data["emergency"]["emergency_contact_phone"] == "+91 98765 43210"

    # With 6 verified facilities and verified routes, confidence must be HIGH
    assert data["confidence_level"] == ConfidenceLevel.HIGH.value
    assert data["coverage_score"] > 80.0


def test_generate_accessibility_plan_routes_and_timeline(client, db: Session, default_user):
    """Verifies that plan generation analyzes timeline barriers, route navigation, and breaks."""
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Annual Developers Conference",
        event_type=EventType.COMMUNITY.value,
        target_budget=60000.0,
    )
    db.add(event)
    db.commit()

    # Seed timeline activities
    now = datetime.now(timezone.utc)
    act1 = TimelineActivity(
        id=str(uuid.uuid4()),
        event_id=event.id,
        title="Keynote Marathon Session",
        start_time=now,
        end_time=now + timedelta(minutes=120),  # > 90 mins -> barrier trigger
        description="Continuous presentations without scheduled break",
    )
    act2 = TimelineActivity(
        id=str(uuid.uuid4()),
        event_id=event.id,
        title="Evening DJ Dance Party & Concert",
        start_time=now + timedelta(hours=3),
        end_time=now + timedelta(hours=5),
        description="High volume live DJ set with strobe lighting",
    )
    db.add_all([act1, act2])

    # Configure sensory and hearing requirements
    client.put(
        f"/api/v1/events/{event.id}/accessibility/profile",
        json={"sensory_sensitivities": True, "hearing_impairment": True, "wheelchair_accessibility": True},
    )

    res = client.post(f"/api/v1/events/{event.id}/accessibility/plan")
    assert res.status_code == status.HTTP_200_OK

    plan = res.json()["data"]
    assert plan["event_id"] == event.id
    assert "summary" in plan
    assert len(plan["accessible_routes"]) > 0
    assert len(plan["accessible_facilities"]) == 8

    # Timeline barrier checks
    timeline_items = plan["accessible_timeline"]
    barriers = [item["potential_barrier"] for item in timeline_items]
    assert any("exceeds 90 minutes" in b for b in barriers)
    assert any("sensory overload" in b or "lighting" in b or "acoustics" in b for b in barriers)

    # Why this plan section
    why_this_plan = plan["why_this_plan"]
    assert "coverage_score" in why_this_plan
    assert "compliance_disclaimer" in why_this_plan
    assert "legal or architectural building compliance" in why_this_plan["compliance_disclaimer"]


def test_privacy_safeguard_guest_aggregation(client, db: Session, default_user):
    """
    CRITICAL PRIVACY TEST:
    Ensures guest names, emails, and phone numbers are completely omitted from
    generated accessibility plans and never leaked across API boundaries.
    """
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Private VIP Gala",
        event_type=EventType.WEDDING.value,
        target_budget=100000.0,
    )
    db.add(event)
    db.commit()

    # Seed guests with sensitive identifiers and accessibility requests
    guest1 = Guest(
        id=str(uuid.uuid4()),
        event_id=event.id,
        name="SensitiveGuestAlice Smith",
        email="alice.smith.secret@privacymail.org",
        phone="+1 555 987 6543",
        accessibility_requirements="Attendee requires wheelchair access and accessible restroom.",
    )
    guest2 = Guest(
        id=str(uuid.uuid4()),
        event_id=event.id,
        name="SensitiveGuestBob Jones",
        email="bob.jones.private@healthcorp.com",
        phone="+1 555 123 4567",
        accessibility_requirements="Attendee has sensory sensitivity to loud sounds and requires quiet room.",
    )
    db.add_all([guest1, guest2])
    db.commit()

    res = client.post(f"/api/v1/events/{event.id}/accessibility/plan")
    assert res.status_code == status.HTTP_200_OK

    raw_response_text = res.text

    # Strict Privacy Assertions: NO personal PII may appear in the plan
    assert "SensitiveGuestAlice Smith" not in raw_response_text
    assert "alice.smith.secret@privacymail.org" not in raw_response_text
    assert "+1 555 987 6543" not in raw_response_text
    assert "SensitiveGuestBob Jones" not in raw_response_text
    assert "bob.jones.private@healthcorp.com" not in raw_response_text
    assert "+1 555 123 4567" not in raw_response_text


def test_accessibility_multi_tenant_isolation(unauthenticated_client, db: Session, default_user):
    """Verifies that an event's accessibility profile cannot be read or modified by another user."""
    # Create event owned by default_user
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Default User Private Event",
        event_type=EventType.BIRTHDAY.value,
        target_budget=20000.0,
    )
    db.add(event)
    db.commit()

    # Create second unauthorized user
    from app.models.user import User
    from app.core.security import create_access_token, hash_password
    other_user = User(
        id=str(uuid.uuid4()),
        email="intruder@eventflow.org",
        hashed_password=hash_password("IntruderPassword123!"),
        full_name="Intruder User",
        is_active=True,
        is_superuser=False,
    )
    db.add(other_user)
    db.commit()

    other_token = create_access_token({"sub": other_user.id, "email": other_user.email})

    # Unauthorized user attempts GET
    get_res = unauthenticated_client.get(
        f"/api/v1/events/{event.id}/accessibility",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert get_res.status_code == status.HTTP_403_FORBIDDEN

    # Unauthorized user attempts PUT profile
    put_res = unauthenticated_client.put(
        f"/api/v1/events/{event.id}/accessibility/profile",
        json={"wheelchair_accessibility": True},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert put_res.status_code == status.HTTP_403_FORBIDDEN

    # Unauthorized user attempts POST plan
    post_res = unauthenticated_client.post(
        f"/api/v1/events/{event.id}/accessibility/plan",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert post_res.status_code == status.HTTP_403_FORBIDDEN


def test_missing_venue_information_warnings(client, db: Session, default_user):
    """Verifies that unverified venue facilities generate explicit organizer action items."""
    event = Event(
        id=str(uuid.uuid4()),
        owner_id=default_user.id,
        title="Unverified Venue Event",
        event_type=EventType.COMMUNITY.value,
        target_budget=30000.0,
    )
    db.add(event)
    db.commit()

    # Configure requirements but leave venue unverified
    client.put(
        f"/api/v1/events/{event.id}/accessibility/profile",
        json={"wheelchair_accessibility": True, "sensory_sensitivities": True},
    )

    plan_res = client.get(f"/api/v1/events/{event.id}/accessibility/plan")
    assert plan_res.status_code == status.HTTP_200_OK

    data = plan_res.json()["data"]
    why_this_plan = data["why_this_plan"]

    assert len(why_this_plan["unverified_warnings"]) > 0
    assert len(why_this_plan["missing_information"]) > 0
    assert any("wheelchair" in w.lower() or "entrance" in w.lower() for w in why_this_plan["unverified_warnings"])
