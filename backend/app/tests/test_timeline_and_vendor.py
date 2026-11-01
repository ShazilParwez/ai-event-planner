from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from pydantic import ValidationError
from fastapi import HTTPException
from app.models.event import Event, EventType, EventStatus
from app.models.timeline import TimelineMilestone, TimelineActivity, MilestoneStatus, MilestonePriority
from app.models.vendor import VendorItem, VendorCategory, VendorStatus
from app.schemas.event import EventCreate
from app.schemas.timeline import (
    TimelineMilestoneCreate,
    TimelineMilestoneUpdate,
    TimelineActivityCreate,
    TimelineActivityUpdate,
)
from app.schemas.vendor import (
    VendorItemCreate,
    VendorItemUpdate,
)
from app.services.event_service import EventService
from app.services.timeline_service import TimelineService
from app.services.vendor_service import VendorService


@pytest.fixture
def test_event(db):
    event_in = EventCreate(
        title="Pooja & Rohan Sangeet & Wedding",
        event_type=EventType.WEDDING,
        description="3-day royal celebration in Udaipur",
        location="Udaipur, Rajasthan",
        target_budget=Decimal("5000000.00"),
        currency="INR",
        expected_guest_count=400,
        start_date=datetime.now(timezone.utc) + timedelta(days=90),
    )
    return EventService.create_event(db, event_in)


# ==============================================================================
# 1. Timeline & Milestone Tests
# ==============================================================================

def test_milestone_crud_and_status_transitions(db, test_event):
    # Create milestone
    ms_in = TimelineMilestoneCreate(
        title="Confirm Heritage Palace Venue",
        phase="5_MONTHS_BEFORE",
        priority=MilestonePriority.CRITICAL,
        target_date=datetime.now(timezone.utc) + timedelta(days=30),
        description="Sign contract and pay venue deposit",
        status=MilestoneStatus.PENDING,
    )
    milestone = TimelineService.create_milestone(db, test_event.id, ms_in)
    assert milestone.id is not None
    assert milestone.title == "Confirm Heritage Palace Venue"
    assert milestone.priority == "CRITICAL"
    assert milestone.status == "PENDING"
    assert milestone.is_completed is False

    # Update milestone to IN_PROGRESS and then COMPLETED
    upd_in = TimelineMilestoneUpdate(
        status=MilestoneStatus.IN_PROGRESS,
        priority=MilestonePriority.HIGH,
    )
    updated = TimelineService.update_milestone(db, test_event.id, milestone.id, upd_in)
    assert updated.status == "IN_PROGRESS"
    assert updated.priority == "HIGH"
    assert updated.is_completed is False

    # Mark as completed
    upd_comp = TimelineMilestoneUpdate(status=MilestoneStatus.COMPLETED)
    completed = TimelineService.update_milestone(db, test_event.id, milestone.id, upd_comp)
    assert completed.status == "COMPLETED"
    assert completed.is_completed is True

    # Delete milestone
    TimelineService.delete_milestone(db, test_event.id, milestone.id)
    assert db.query(TimelineMilestone).filter(TimelineMilestone.id == milestone.id).first() is None


def test_seed_default_milestones(db, test_event):
    seeded = TimelineService.seed_default_milestones(db, test_event.id)
    assert len(seeded) == 8

    # Verify overview calculations
    overview = TimelineService.get_timeline_overview(db, test_event.id)
    assert overview.total_milestones == 8
    assert overview.completed_milestones == 0
    assert overview.pending_milestones == 8
    assert overview.completion_percentage == 0.0

    # Complete 2 milestones
    TimelineService.update_milestone(
        db, test_event.id, seeded[0].id, TimelineMilestoneUpdate(status=MilestoneStatus.COMPLETED)
    )
    TimelineService.update_milestone(
        db, test_event.id, seeded[1].id, TimelineMilestoneUpdate(status=MilestoneStatus.COMPLETED)
    )

    overview2 = TimelineService.get_timeline_overview(db, test_event.id)
    assert overview2.completed_milestones == 2
    assert overview2.pending_milestones == 6
    assert overview2.completion_percentage == 25.0  # 2/8 = 25%


def test_overdue_milestone_detection(db, test_event):
    # Create milestone with past target date
    past_date = datetime.now(timezone.utc) - timedelta(days=5)
    ms_in = TimelineMilestoneCreate(
        title="Overdue Caterer Finalization",
        phase="2_MONTHS_BEFORE",
        priority=MilestonePriority.CRITICAL,
        target_date=past_date,
        status=MilestoneStatus.PENDING,
    )
    ms = TimelineService.create_milestone(db, test_event.id, ms_in)

    overview = TimelineService.get_timeline_overview(db, test_event.id)
    assert overview.overdue_milestones == 1
    assert overview.milestones[0].is_overdue is True

    # When marked completed, overdue status should clear
    TimelineService.update_milestone(
        db, test_event.id, ms.id, TimelineMilestoneUpdate(status=MilestoneStatus.COMPLETED)
    )
    overview_done = TimelineService.get_timeline_overview(db, test_event.id)
    assert overview_done.overdue_milestones == 0
    assert overview_done.milestones[0].is_overdue is False


def test_activity_crud_and_date_validation(db, test_event):
    start = datetime.now(timezone.utc) + timedelta(days=90, hours=10)
    end = start + timedelta(hours=2)

    # 1. Valid activity
    act_in = TimelineActivityCreate(
        title="Royal Baraat Procession",
        start_time=start,
        end_time=end,
        responsible_party="Groom's Entourage & Brass Band",
        location="Palace Front Courtyard",
        status="SCHEDULED",
        order_index=1,
    )
    activity = TimelineService.create_activity(db, test_event.id, act_in)
    assert activity.id is not None
    assert activity.title == "Royal Baraat Procession"

    # 2. Invalid date range (end earlier than start) must raise Pydantic ValidationError
    with pytest.raises(ValidationError) as exc:
        TimelineActivityCreate(
            title="Invalid Time Slot",
            start_time=start,
            end_time=start - timedelta(minutes=30),
        )
    assert "Activity end_time cannot be earlier than start_time" in str(exc.value)


def test_timeline_cross_event_isolation(db, test_event):
    # Create a second event
    other_event = EventService.create_event(
        db, EventCreate(title="Beta Birthday Party", event_type=EventType.BIRTHDAY)
    )
    other_ms = TimelineService.create_milestone(
        db,
        other_event.id,
        TimelineMilestoneCreate(title="Beta Milestone", phase="PLANNING"),
    )

    # Attempt to attach activity to other_event's milestone must fail
    with pytest.raises(HTTPException) as exc:
        TimelineService.create_activity(
            db,
            test_event.id,
            TimelineActivityCreate(
                milestone_id=other_ms.id,
                title="Cross Event Activity Attempt",
                start_time=datetime.now(timezone.utc),
            ),
        )
    assert exc.value.status_code == 400
    assert "does not belong to event" in exc.value.detail.lower()


# ==============================================================================
# 2. Vendor Management Tests
# ==============================================================================

def test_vendor_crud_and_status_transitions(db, test_event):
    # Create vendor item
    item_in = VendorItemCreate(
        category="Catering",
        name="Royal Rajputana Feasts",
        contact_name="Chef Vikram Singh",
        contact_phone="+91 98765 43210",
        contact_email="vikram@rajputanafeasts.com",
        location="Jaipur / Udaipur",
        website="https://rajputanafeasts.com",
        status=VendorStatus.DISCOVERING,
        estimated_quote=Decimal("1200000.00"),
        final_agreed_price=Decimal("1150000.00"),
        advance_paid=Decimal("300000.00"),
        contract_signed=False,
        notes="Includes 5 live chaat stalls and traditional dessert buffet",
    )
    vendor = VendorService.create_vendor(db, test_event.id, item_in)
    assert vendor.id is not None
    assert vendor.name == "Royal Rajputana Feasts"
    assert vendor.status == "DISCOVERING"
    assert vendor.advance_paid == Decimal("300000.00")
    assert vendor.remaining_payment == Decimal("850000.00")  # 1150000 - 300000

    # Transition status: DISCOVERING -> QUOTED -> NEGOTIATING -> BOOKED
    v_quoted = VendorService.update_vendor(
        db, test_event.id, vendor.id, VendorItemUpdate(status=VendorStatus.QUOTED)
    )
    assert v_quoted.status == "QUOTED"

    v_booked = VendorService.update_vendor(
        db,
        test_event.id,
        vendor.id,
        VendorItemUpdate(status=VendorStatus.BOOKED, contract_signed=True),
    )
    assert v_booked.status == "BOOKED"
    assert v_booked.contract_signed is True

    # Delete vendor
    VendorService.delete_vendor(db, test_event.id, vendor.id)
    assert db.query(VendorItem).filter(VendorItem.id == vendor.id).first() is None


def test_vendor_financial_summary_and_decimal_precision(db, test_event):
    # Vendor 1: Booked
    VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(
            category="Venue",
            name="Udaivilas Palace Grounds",
            status=VendorStatus.BOOKED,
            estimated_quote=Decimal("2000000.00"),
            final_agreed_price=Decimal("1950000.50"),
            advance_paid=Decimal("500000.25"),
            contract_signed=True,
        ),
    )

    # Vendor 2: Contacted (Not yet booked)
    VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(
            category="Photography",
            name="Heritage Frames Studio",
            status=VendorStatus.CONTACTED,
            estimated_quote=Decimal("450000.25"),
            final_agreed_price=None,
            advance_paid=Decimal("0.00"),
        ),
    )

    # Vendor 3: Booked
    VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(
            category="Decoration",
            name="Marwar Flora & Lights",
            status=VendorStatus.BOOKED,
            estimated_quote=Decimal("600000.00"),
            final_agreed_price=Decimal("580000.25"),
            advance_paid=Decimal("200000.25"),
            contract_signed=True,
        ),
    )

    summary = VendorService.get_vendor_summary(db, test_event.id)
    assert summary.total_vendors == 3
    assert summary.booked_vendors == 2
    assert summary.pending_vendors == 1

    # Exact Decimal Calculations:
    # total_quoted = 2000000 + 450000.25 + 600000 = 3050000.25
    assert summary.total_quoted_amount == Decimal("3050000.25")

    # total_agreed = 1950000.50 + 0 + 580000.25 = 2530000.75
    assert summary.total_agreed_cost == Decimal("2530000.75")

    # total_advance_paid = 500000.25 + 0 + 200000.25 = 700000.50
    assert summary.total_advance_paid == Decimal("700000.50")

    # total_contracted_spend (booked vendors only) = 1950000.50 + 580000.25 = 2530000.75
    assert summary.total_contracted_spend == Decimal("2530000.75")

    # remaining_payment = 2530000.75 - 700000.50 = 1830000.25
    assert summary.total_remaining_payment == Decimal("1830000.25")


def test_vendor_category_filtering(db, test_event):
    VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(category="Venue", name="Venue 1", status=VendorStatus.BOOKED),
    )
    VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(category="Venue", name="Venue 2", status=VendorStatus.DISCOVERING),
    )
    VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(category="Catering", name="Catering 1", status=VendorStatus.QUOTED),
    )

    # Filter by category
    venue_summary = VendorService.get_vendor_summary(db, test_event.id, category="Venue")
    assert len(venue_summary.items) == 2
    assert all(v.category == "Venue" for v in venue_summary.items)

    # Filter by category and status
    booked_venue = VendorService.get_vendor_summary(
        db, test_event.id, category="Venue", status_filter="BOOKED"
    )
    assert len(booked_venue.items) == 1
    assert booked_venue.items[0].name == "Venue 1"


def test_vendor_advance_ceiling_validation(db, test_event):
    # Advance payment cannot exceed agreed/quoted cost
    with pytest.raises(ValidationError) as exc:
        VendorItemCreate(
            category="Entertainment",
            name="Bollywood DJ Beats",
            estimated_quote=Decimal("50000.00"),
            final_agreed_price=Decimal("40000.00"),
            advance_paid=Decimal("60000.00"),  # > 40000
        )
    assert "Advance paid" in str(exc.value)


def test_cascade_delete_event_cleans_timeline_and_vendors(db, test_event):
    # Add milestone, activity, vendor
    ms = TimelineService.create_milestone(
        db, test_event.id, TimelineMilestoneCreate(title="Test MS", phase="PLANNING")
    )
    act = TimelineService.create_activity(
        db,
        test_event.id,
        TimelineActivityCreate(title="Test Act", start_time=datetime.now(timezone.utc)),
    )
    vendor = VendorService.create_vendor(
        db,
        test_event.id,
        VendorItemCreate(category="Other", name="Test Vendor"),
    )

    ms_id = ms.id
    act_id = act.id
    vendor_id = vendor.id

    # Delete event
    EventService.delete_event(db, test_event.id)

    # Verify everything cascaded cleanly
    assert db.query(TimelineMilestone).filter(TimelineMilestone.id == ms_id).first() is None
    assert db.query(TimelineActivity).filter(TimelineActivity.id == act_id).first() is None
    assert db.query(VendorItem).filter(VendorItem.id == vendor_id).first() is None


# ==============================================================================
# 3. HTTP API Endpoints Tests
# ==============================================================================

def test_api_timeline_endpoints(client, test_event):
    # 1. Seed milestones
    seed_res = client.post(f"/api/v1/events/{test_event.id}/timeline/milestones/seed")
    assert seed_res.status_code == 201
    assert len(seed_res.json()["data"]) == 8

    # 2. Get overview
    overview_res = client.get(f"/api/v1/events/{test_event.id}/timeline")
    assert overview_res.status_code == 200
    data = overview_res.json()["data"]
    assert data["total_milestones"] == 8
    first_ms_id = data["milestones"][0]["id"]

    # 3. Update milestone status
    upd_res = client.put(
        f"/api/v1/events/{test_event.id}/timeline/milestones/{first_ms_id}",
        json={"status": "COMPLETED"},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["data"]["status"] == "COMPLETED"

    # 4. Schedule activity
    start = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=90, hours=1)).isoformat()
    act_res = client.post(
        f"/api/v1/events/{test_event.id}/timeline/activities",
        json={
            "title": "Welcome Drinks & Registration",
            "start_time": start,
            "end_time": end,
            "milestone_id": first_ms_id,
            "location": "Palace Garden Lobby",
        },
    )
    assert act_res.status_code == 201
    act_id = act_res.json()["data"]["id"]

    # 5. Delete activity
    del_act = client.delete(f"/api/v1/events/{test_event.id}/timeline/activities/{act_id}")
    assert del_act.status_code == 200


def test_api_vendor_endpoints(client, test_event):
    # 1. Get categories (auto-seeds)
    cat_res = client.get("/api/v1/vendors/categories")
    assert cat_res.status_code == 200
    assert len(cat_res.json()["data"]) >= 10

    # 2. Add vendor
    vendor_payload = {
        "category": "Photography",
        "name": "Karmic Clicks Studios",
        "contact_name": "Ananya Sen",
        "contact_phone": "+91 99887 76655",
        "location": "Mumbai",
        "status": "QUOTED",
        "estimated_quote": "350000.00",
        "final_agreed_price": "320000.00",
        "advance_paid": "100000.00",
    }
    create_res = client.post(f"/api/v1/events/{test_event.id}/vendors", json=vendor_payload)
    assert create_res.status_code == 201
    v_data = create_res.json()["data"]
    vendor_id = v_data["id"]
    assert v_data["name"] == "Karmic Clicks Studios"

    # 3. Get summary
    sum_res = client.get(f"/api/v1/events/{test_event.id}/vendors")
    assert sum_res.status_code == 200
    s_data = sum_res.json()["data"]
    assert s_data["total_vendors"] == 1
    assert s_data["total_quoted_amount"] == "350000.00"
    assert s_data["total_advance_paid"] == "100000.00"

    # 4. Update vendor status to BOOKED
    upd_res = client.put(
        f"/api/v1/events/{test_event.id}/vendors/{vendor_id}",
        json={"status": "BOOKED", "contract_signed": True},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["data"]["status"] == "BOOKED"

    # 5. Delete vendor
    del_res = client.delete(f"/api/v1/events/{test_event.id}/vendors/{vendor_id}")
    assert del_res.status_code == 200
