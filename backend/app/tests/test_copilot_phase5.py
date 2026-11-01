import asyncio
from datetime import datetime, timezone, timedelta
import json
import uuid
from decimal import Decimal
import pytest
from fastapi import status

from app.models.event import EventType
from app.models.copilot import CopilotAction, CopilotActionStatus, CopilotActionType, CopilotThread, CopilotMessage
from app.models.timeline import TimelineMilestone
from app.models.budget import BudgetItem, BudgetCategory
from app.models.vendor import VendorItem
from app.models.guest import Guest
from app.schemas.copilot import CopilotThreadCreate, CopilotMessageCreate, CopilotActionExecuteResponse
from app.schemas.vendor import VendorItemCreate
from app.services.copilot_context_builder import CopilotContextBuilder
from app.services.copilot_service import CopilotService
from app.services.vendor_service import VendorService
from app.services.timeline_service import TimelineService
from app.tests.conftest import TestingSessionLocal
from fastapi import HTTPException
from app.services.ai.fallback import generate_fallback_chat_reply
from app.schemas.ai import AICopilotChatRequest
from app.services.ai.orchestrator import AICopilotOrchestrator, CircuitBreaker


@pytest.fixture
def sample_event_id(client):
    res = client.post(
        "/api/v1/events",
        json={
            "title": "Aarav & Meera Royal Sangeet",
            "event_type": "WEDDING",
            "target_budget": "5000000.00",
            "expected_guest_count": 300,
            "currency": "INR",
            "location": "Jaipur Palace, Rajasthan",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    return res.json()["data"]["id"]


@pytest.fixture
def second_event_id(client):
    res = client.post(
        "/api/v1/events",
        json={
            "title": "DevFest Jaipur 2026",
            "event_type": "COMMUNITY",
            "target_budget": "200000.00",
            "expected_guest_count": 150,
            "currency": "INR",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    return res.json()["data"]["id"]


# ============================================================================
# 1. Action Scope & Lifecycle Tests
# ============================================================================

def test_copilot_thread_lifecycle(client, sample_event_id):
    """Test thread creation, listing, retrieval, and deletion."""
    # 1. Create thread
    res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads",
        json={"title": "Budget & Catering Strategy"},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["data"]
    thread_id = data["id"]
    assert data["event_id"] == sample_event_id
    assert data["title"] == "Budget & Catering Strategy"

    # 2. List threads
    list_res = client.get(f"/api/v1/events/{sample_event_id}/copilot/threads")
    assert list_res.status_code == status.HTTP_200_OK
    threads = list_res.json()["data"]
    assert len(threads) >= 1
    assert any(t["id"] == thread_id for t in threads)

    # 3. Delete thread
    del_res = client.delete(f"/api/v1/events/{sample_event_id}/copilot/threads/{thread_id}")
    assert del_res.status_code == status.HTTP_204_NO_CONTENT

    # 4. Verify thread deleted
    list_after = client.get(f"/api/v1/events/{sample_event_id}/copilot/threads")
    assert not any(t["id"] == thread_id for t in list_after.json()["data"])


def test_copilot_chat_message_flow(client, sample_event_id):
    """Test sending user messages, storing assistant responses, and retrieving dialogue history."""
    t_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads",
        json={"title": "Milestone & Vendor Sync"},
    )
    thread_id = t_res.json()["data"]["id"]

    chat_payload = {"content": "We need to schedule vendor sound checks and stage rigging"}
    msg_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread_id}/messages",
        json=chat_payload,
    )
    assert msg_res.status_code == status.HTTP_200_OK
    ai_data = msg_res.json()["data"]
    assert "response" in ai_data
    assert len(ai_data["response"]) > 0
    assert "suggested_prompts" in ai_data
    assert len(ai_data["proposed_actions"]) > 0

    proposed = ai_data["proposed_actions"][0]
    assert proposed["status"] == "PENDING"
    assert "action_id" in proposed
    # Ensure action type is in the authorized 3 types
    assert proposed["action_type"] in [
        CopilotActionType.ADD_TIMELINE_MILESTONE.value,
        CopilotActionType.ADD_BUDGET_EXPENSE.value,
        CopilotActionType.ADD_VENDOR_ITEM.value,
    ]

    hist_res = client.get(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread_id}/messages"
    )
    assert hist_res.status_code == status.HTTP_200_OK
    messages = hist_res.json()["data"]
    assert len(messages) >= 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == chat_payload["content"]
    assert messages[1]["role"] == "assistant"
    assert len(messages[1]["proposed_actions"]) > 0


def test_unsupported_action_rejection(db, client, sample_event_id):
    """Verify that any unauthorized action type is rejected with HTTP 400 Bad Request."""
    t_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Scope Test"})
    thread_id = t_res.json()["data"]["id"]

    # Manually inject an unauthorized action into DB to test execution rejection
    unauthorized_action = CopilotAction(
        thread_id=thread_id,
        event_id=sample_event_id,
        action_type="ADD_GUEST_PROFILE",  # Unauthorized
        title="Unauthorized Guest Creation",
        description="Testing rejection of unauthorized action scope",
        parameters=json.dumps({"name": "Unauthorized Guest"}),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(unauthorized_action)
    db.commit()
    db.refresh(unauthorized_action)

    exec_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{unauthorized_action.id}/execute"
    )
    assert exec_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "unsupported action type" in exec_res.json()["detail"].lower()


def test_action_approval_and_execution_lifecycle(db, client, sample_event_id):
    """Test full interactive action approval lifecycle:
    PENDING status -> User clicks Approve -> Domain service executes -> EXECUTED status.
    """
    t_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Action Test"})
    thread_id = t_res.json()["data"]["id"]

    msg_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread_id}/messages",
        json={"content": "Can you recommend a timeline milestone for rehearsal?"},
    )
    ai_data = msg_res.json()["data"]
    assert len(ai_data["proposed_actions"]) > 0
    action = ai_data["proposed_actions"][0]
    action_id = action["action_id"]

    # Explicit User Approval: Execute action
    exec_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{action_id}/execute"
    )
    assert exec_res.status_code == status.HTTP_200_OK
    exec_data = exec_res.json()["data"]
    assert exec_data["status"] == "EXECUTED"
    assert exec_data["created_resource_id"] is not None

    # Verify action in DB is marked EXECUTED and executed_at is recorded
    db_act = db.query(CopilotAction).filter(CopilotAction.id == action_id).first()
    assert db_act.status == CopilotActionStatus.EXECUTED.value
    assert db_act.executed_at is not None

    # Verify duplicate execution is rejected
    dup_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{action_id}/execute"
    )
    assert dup_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "already been approved" in dup_res.json()["detail"].lower()

    # Verify executed action cannot be dismissed
    dismiss_dup = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{action_id}/dismiss"
    )
    assert dismiss_dup.status_code == status.HTTP_400_BAD_REQUEST


def test_failed_execution_preserves_pending(db, client, sample_event_id):
    """Verify that failed execution (e.g. invalid domain parameters) rolls back and leaves action PENDING."""
    t_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Fail Test"})
    thread_id = t_res.json()["data"]["id"]

    # Inject an action with parameters that violate domain constraint (advance_paid > estimated_quote)
    invalid_action = CopilotAction(
        thread_id=thread_id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_VENDOR_ITEM.value,
        title="Invalid Vendor Item",
        description="Fails domain constraint",
        parameters=json.dumps({
            "name": "Luxury Limousines",
            "category": "Transportation",
            "estimated_quote": "50000.00",
            "advance_paid": "90000.00",  # VIOLATION: advance > quote
        }),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(invalid_action)
    db.commit()
    db.refresh(invalid_action)

    exec_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{invalid_action.id}/execute"
    )
    # Must fail with validation error
    assert exec_res.status_code in [status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_400_BAD_REQUEST]

    # Crucial Requirement: Action must remain PENDING and executed_at must be None
    db_act = db.query(CopilotAction).filter(CopilotAction.id == invalid_action.id).first()
    assert db_act.status == CopilotActionStatus.PENDING.value
    assert db_act.executed_at is None


def test_action_dismissal_lifecycle(client, sample_event_id):
    """Test action dismissal lifecycle: PENDING -> DISMISSED -> execution rejected."""
    t_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Dismiss Test"})
    thread_id = t_res.json()["data"]["id"]

    msg_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread_id}/messages",
        json={"content": "Suggest a vendor for catering"},
    )
    ai_data = msg_res.json()["data"]
    action = ai_data["proposed_actions"][0]
    action_id = action["action_id"]

    # Dismiss the action
    dis_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{action_id}/dismiss"
    )
    assert dis_res.status_code == status.HTTP_200_OK
    assert dis_res.json()["data"]["status"] == "DISMISSED"

    # Attempting to execute dismissed action should fail
    exec_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/actions/{action_id}/execute"
    )
    assert exec_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "dismissed" in exec_res.json()["detail"].lower()


# ============================================================================
# 2. Execution Integrity & Concurrency Tests
# ============================================================================

def test_cross_event_security_isolation(client, sample_event_id, second_event_id):
    """Verify actions and threads belonging to Event A cannot be executed or accessed by Event B."""
    t_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Event A Thread"})
    thread_id = t_res.json()["data"]["id"]

    msg_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread_id}/messages",
        json={"content": "Add milestone for event A"},
    )
    action_id = msg_res.json()["data"]["proposed_actions"][0]["action_id"]

    # Attempt to execute Event A's action using Event B route -> 404
    cross_res = client.post(
        f"/api/v1/events/{second_event_id}/copilot/actions/{action_id}/execute"
    )
    assert cross_res.status_code == status.HTTP_404_NOT_FOUND

    # Attempt to access Event A's thread messages using Event B route -> 404
    cross_msg = client.get(
        f"/api/v1/events/{second_event_id}/copilot/threads/{thread_id}/messages"
    )
    assert cross_msg.status_code == status.HTTP_404_NOT_FOUND


def test_wrong_thread_rejection(client, sample_event_id):
    """Verify that specifying a mismatched thread_id rejects action execution."""
    t1_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Thread 1"})
    thread1_id = t1_res.json()["data"]["id"]

    t2_res = client.post(f"/api/v1/events/{sample_event_id}/copilot/threads", json={"title": "Thread 2"})
    thread2_id = t2_res.json()["data"]["id"]

    msg_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread1_id}/messages",
        json={"content": "Add milestone for thread 1"},
    )
    action_id = msg_res.json()["data"]["proposed_actions"][0]["action_id"]

    # Attempt to execute action belonging to Thread 1 via Thread 2 route
    wrong_thread_res = client.post(
        f"/api/v1/events/{sample_event_id}/copilot/threads/{thread2_id}/actions/{action_id}/execute"
    )
    assert wrong_thread_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "does not belong to thread" in wrong_thread_res.json()["detail"].lower()


def test_concurrent_execution_protection(db, sample_event_id):
    """Verify atomic state check prevents simultaneous double-execution of the same action."""
    thread = CopilotThread(event_id=sample_event_id, title="Concurrency Thread")
    db.add(thread)
    db.commit()

    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_TIMELINE_MILESTONE.value,
        title="Unique Concurrent Milestone",
        parameters=json.dumps({"title": "Unique Concurrent Milestone", "phase": "GENERAL"}),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    # First execution succeeds
    res1 = CopilotService.execute_action(db, sample_event_id, action.id)
    assert res1.status == "EXECUTED"

    # Simulated simultaneous second execution fails
    with pytest.raises(Exception) as exc_info:
        CopilotService.execute_action(db, sample_event_id, action.id)
    assert "already been approved" in str(exc_info.value).lower()


def test_database_rollback_after_domain_service_failure(db, sample_event_id):
    """Verify that a failure during domain execution rolls back partial mutations and leaves action PENDING."""
    thread = CopilotThread(event_id=sample_event_id, title="Rollback Thread")
    db.add(thread)
    db.commit()

    # Pre-count milestones
    initial_milestone_count = db.query(TimelineMilestone).filter(TimelineMilestone.event_id == sample_event_id).count()

    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_VENDOR_ITEM.value,
        title="Failing Action",
        parameters=json.dumps({
            "name": "Illegal Advance Caterer",
            "category": "Catering",
            "estimated_quote": "10000.00",
            "advance_paid": "50000.00",  # Violates ceiling
        }),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    with pytest.raises(Exception):
        CopilotService.execute_action(db, sample_event_id, action.id)

    # Re-query action: must remain PENDING
    db.refresh(action)
    assert action.status == CopilotActionStatus.PENDING.value
    assert action.executed_at is None

    # No orphan vendor items created
    orphan_vendors = db.query(VendorItem).filter(VendorItem.name == "Illegal Advance Caterer").count()
    assert orphan_vendors == 0


def test_action_status_and_domain_mutation_consistency(db, sample_event_id):
    """Verify domain mutation and action status are transactionally committed together."""
    thread = CopilotThread(event_id=sample_event_id, title="Consistency Thread")
    db.add(thread)
    db.commit()

    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_TIMELINE_MILESTONE.value,
        title="Transactional Consistency Milestone",
        parameters=json.dumps({"title": "Transactional Consistency Milestone", "priority": "HIGH"}),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    res = CopilotService.execute_action(db, sample_event_id, action.id)
    assert res.status == "EXECUTED"
    created_id = res.created_resource_id

    # Verify milestone exists in DB
    ms = db.query(TimelineMilestone).filter(TimelineMilestone.id == created_id).first()
    assert ms is not None
    assert ms.title == "Transactional Consistency Milestone"


def test_failed_action_status_recovery_fresh_session(db, sample_event_id, monkeypatch):
    """Verify that an action whose claim was committed but domain service raised an exception
    recovers status to PENDING and leaves executed_at as None when reloaded from a fresh database session,
    with no partial domain mutation committed."""
    thread = CopilotThread(event_id=sample_event_id, title="Recovery Fresh Session Thread")
    db.add(thread)
    db.commit()

    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_TIMELINE_MILESTONE.value,
        title="Unstable Milestone",
        parameters=json.dumps({"title": "Unstable Milestone", "phase": "GENERAL"}),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    # Define a domain service mock that flushes a partial object and then raises
    def mock_create_milestone(session, evt_id, data):
        # Insert a partial mutation that must not be committed
        partial_ms = TimelineMilestone(
            event_id=evt_id,
            title="Partial Ghost Milestone",
            phase="GENERAL",
            priority="HIGH",
        )
        session.add(partial_ms)
        session.flush()
        raise RuntimeError("Simulated crash in domain service after claim commit")

    monkeypatch.setattr(TimelineService, "create_milestone", mock_create_milestone)

    # Execute action and ensure it raises HTTP 422
    with pytest.raises(HTTPException) as exc_info:
        CopilotService.execute_action(db, sample_event_id, action.id)
    assert exc_info.value.status_code == 422

    # Reload action using a FRESH database session
    with TestingSessionLocal() as fresh_db:
        reloaded_action = fresh_db.query(CopilotAction).filter(CopilotAction.id == action.id).first()
        assert reloaded_action is not None
        assert reloaded_action.status == CopilotActionStatus.PENDING.value
        assert reloaded_action.executed_at is None

        # Verify no partial domain mutation was committed
        ghosts = fresh_db.query(TimelineMilestone).filter(
            TimelineMilestone.title == "Partial Ghost Milestone"
        ).all()
        assert len(ghosts) == 0


def test_add_vendor_item_creates_checklist_procurement_item(db, sample_event_id):
    """Verify ADD_VENDOR_ITEM creates a genuine VendorItem with is_ai_suggested_checklist=True."""
    thread = CopilotThread(event_id=sample_event_id, title="Vendor Checklist Thread")
    db.add(thread)
    db.commit()

    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_VENDOR_ITEM.value,
        title="Royal Mandap Florist",
        parameters=json.dumps({
            "name": "Royal Mandap Florist",
            "category": "Decoration",
            "estimated_quote": "75000.00",
            "advance_paid": "15000.00",
            "status": "DISCOVERING",
            "notes": "Floral styling for Mandap",
        }),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    res = CopilotService.execute_action(db, sample_event_id, action.id)
    assert res.status == "EXECUTED"
    assert res.details.get("action") == "created"
    assert res.details.get("is_ai_suggested_checklist") is True

    # Reload via fresh session
    with TestingSessionLocal() as fresh_db:
        vendor = fresh_db.query(VendorItem).filter(VendorItem.id == res.created_resource_id).first()
        assert vendor is not None
        assert vendor.name == "Royal Mandap Florist"
        assert vendor.category == "Decoration"
        assert vendor.is_ai_suggested_checklist is True
        assert vendor.advance_paid == Decimal("15000.00")
        assert vendor.estimated_quote == Decimal("75000.00")


def test_add_vendor_item_updates_existing_vendor_without_duplicate(db, sample_event_id):
    """Verify ADD_VENDOR_ITEM with vendor_id updates the existing vendor record and does NOT create a new duplicate."""
    # 1. Create initial vendor
    existing = VendorService.create_vendor(
        db,
        sample_event_id,
        VendorItemCreate(
            name="Heritage Palace Catering",
            category="Catering",
            estimated_quote=Decimal("250000.00"),
            advance_paid=Decimal("0.00"),
            status="DISCOVERING",
            notes="Initial inquiry",
        ),
    )
    initial_vendor_count = db.query(VendorItem).filter(VendorItem.event_id == sample_event_id).count()

    thread = CopilotThread(event_id=sample_event_id, title="Vendor Update Thread")
    db.add(thread)
    db.commit()

    # 2. Copilot proposes updating this vendor with agreed contract
    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_VENDOR_ITEM.value,
        title="Finalize Catering Contract",
        parameters=json.dumps({
            "vendor_id": existing.id,
            "final_agreed_price": "240000.00",
            "advance_paid": "60000.00",
            "status": "BOOKED",
            "contract_signed": True,
            "notes": "Contract signed with royal chef for 5-course feast.",
        }),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    res = CopilotService.execute_action(db, sample_event_id, action.id)
    assert res.status == "EXECUTED"
    assert res.details.get("action") == "updated"
    assert res.created_resource_id == existing.id

    # 3. Reload via fresh session: assert NO duplicate record was created
    with TestingSessionLocal() as fresh_db:
        total_vendors = fresh_db.query(VendorItem).filter(VendorItem.event_id == sample_event_id).count()
        assert total_vendors == initial_vendor_count  # EXACT count preserved, zero duplicate

        updated = fresh_db.query(VendorItem).filter(VendorItem.id == existing.id).first()
        assert updated is not None
        assert updated.final_agreed_price == Decimal("240000.00")
        assert updated.advance_paid == Decimal("60000.00")
        assert updated.status == "BOOKED"
        assert updated.contract_signed is True
        assert "royal chef" in updated.notes


def test_add_vendor_item_cross_event_rejection(db, sample_event_id, second_event_id):
    """Verify ADD_VENDOR_ITEM referencing a vendor from a different event is rejected with 404/422."""
    other_vendor = VendorService.create_vendor(
        db,
        second_event_id,
        VendorItemCreate(
            name="Other Event Vendor",
            category="Venue",
            status="DISCOVERING",
        ),
    )

    thread = CopilotThread(event_id=sample_event_id, title="Cross Event Thread")
    db.add(thread)
    db.commit()

    action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_VENDOR_ITEM.value,
        title="Unauthorized Cross-Event Vendor Update",
        parameters=json.dumps({
            "vendor_id": other_vendor.id,
            "notes": "Attempt to update vendor from other event",
        }),
        status=CopilotActionStatus.PENDING.value,
    )
    db.add(action)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        CopilotService.execute_action(db, sample_event_id, action.id)
    assert exc_info.value.status_code in [404, 422]

    # Status must remain PENDING
    with TestingSessionLocal() as fresh_db:
        act = fresh_db.query(CopilotAction).filter(CopilotAction.id == action.id).first()
        assert act.status == CopilotActionStatus.PENDING.value
        assert act.executed_at is None


def test_stale_executing_actions_recovery(db, sample_event_id):
    """Verify CopilotService.recover_stale_actions resets orphaned EXECUTING actions to PENDING."""
    thread = CopilotThread(event_id=sample_event_id, title="Stale Thread")
    db.add(thread)
    db.commit()

    stale_action = CopilotAction(
        thread_id=thread.id,
        event_id=sample_event_id,
        action_type=CopilotActionType.ADD_BUDGET_EXPENSE.value,
        title="Orphaned Action",
        parameters=json.dumps({"title": "Orphaned", "cost": "500"}),
        status="EXECUTING",
    )
    db.add(stale_action)
    db.commit()

    recovered_count = CopilotService.recover_stale_actions(db, sample_event_id)
    assert recovered_count >= 1

    with TestingSessionLocal() as fresh_db:
        act = fresh_db.query(CopilotAction).filter(CopilotAction.id == stale_action.id).first()
        assert act.status == CopilotActionStatus.PENDING.value
        assert act.executed_at is None


# ============================================================================
# 3. AI Reliability & Fallback Tests
# ============================================================================

def test_missing_api_key_fallback():
    """Verify missing API key safely triggers deterministic fallback without exception."""
    orchestrator = AICopilotOrchestrator()
    original_key = orchestrator.settings.GEMINI_API_KEY
    original_mock = orchestrator.settings.USE_MOCK_AI

    try:
        orchestrator.settings.USE_MOCK_AI = False
        orchestrator.settings.GEMINI_API_KEY = ""
        orchestrator.gemini_client.api_key = ""

        req = AICopilotChatRequest(event_id="test-1", message="Help with vendors")
        context = {"event": {"title": "Test Wedding", "currency": "INR"}}

        res = asyncio.run(orchestrator.chat_copilot(req, context))
        assert res is not None
        assert res.source in ["deterministic_fallback", "mock"]
        assert len(res.response) > 0
    finally:
        orchestrator.settings.GEMINI_API_KEY = original_key
        orchestrator.settings.USE_MOCK_AI = original_mock


def test_ai_timeout_deadline_fallback():
    """Verify that an AI provider call exceeding deadline falls back within operation timeout."""
    orchestrator = AICopilotOrchestrator()
    original_mock = orchestrator.settings.USE_MOCK_AI
    original_timeout = orchestrator.settings.AI_REQUEST_TIMEOUT_SECONDS

    try:
        orchestrator.settings.USE_MOCK_AI = False
        orchestrator.settings.AI_REQUEST_TIMEOUT_SECONDS = 0.2

        async def _hanging_chat(*args, **kwargs):
            await asyncio.sleep(10.0)

        orchestrator.gemini_client.chat_copilot = _hanging_chat

        req = AICopilotChatRequest(event_id="test-hang", message="Hanging request")
        context = {"event": {"title": "Hanging Event"}}

        res = asyncio.run(orchestrator.chat_copilot(req, context))
        assert res is not None
        assert res.source == "deterministic_fallback"
        assert orchestrator.circuit_breaker.failure_count >= 1
    finally:
        orchestrator.settings.USE_MOCK_AI = original_mock
        orchestrator.settings.AI_REQUEST_TIMEOUT_SECONDS = original_timeout


def test_fallback_chat_reply_logic():
    """Verify deterministic fallback chat produces contextual warnings and proposed actions."""
    req = AICopilotChatRequest(event_id="test-ev-1", message="Help! Are we over budget?")
    context = {
        "event": {"title": "Royal Gala"},
        "budget": {"is_over_budget": True},
        "timeline": {"overdue_milestones": 2},
        "vendors": {"booked_vendors": 1, "total_vendors": 4},
        "guests": {},
    }

    reply = generate_fallback_chat_reply(req, context)
    assert reply.source == "deterministic_fallback"
    assert len(reply.warnings) >= 2
    assert any(w.warning_type == "BUDGET_OVERRUN" for w in reply.warnings)
    assert any(w.warning_type == "TIMELINE_OVERDUE" for w in reply.warnings)
    assert len(reply.proposed_actions) > 0
    assert reply.proposed_actions[0].action_type in [
        CopilotActionType.ADD_TIMELINE_MILESTONE,
        CopilotActionType.ADD_BUDGET_EXPENSE,
        CopilotActionType.ADD_VENDOR_ITEM,
    ]


def test_legacy_chat_endpoint_compatibility(client, sample_event_id):
    """Verify backward compatibility of POST /api/v1/copilot/chat."""
    legacy_payload = {
        "event_id": sample_event_id,
        "message": "What is our current financial status?",
    }
    res = client.post("/api/v1/copilot/chat", json=legacy_payload)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()["data"]
    assert "response" in data
    assert "suggested_actions" in data
    assert data["source"] in ["mock", "gemini", "deterministic_fallback"]


# ============================================================================
# 4. Context Construction & Privacy Tests
# ============================================================================

def test_copilot_context_builder_and_privacy(db, sample_event_id):
    """Verify CopilotContextBuilder includes all event domains and strictly minimizes sensitive guest details."""
    # Seed a guest with personal info to verify exclusion
    guest = Guest(
        event_id=sample_event_id,
        name="Private VIP Person",
        email="vip.private@example.com",
        phone="+91 99999 88888",
        table_assignment="Table 1",
        accessibility_requirements="Wheelchair ramp needed",
        dietary_preferences="Jain Vegetarian",
    )
    db.add(guest)
    db.commit()

    context = CopilotContextBuilder.build_bounded_context(
        db, sample_event_id, current_message="What should we plan next?"
    )

    # 1. Verify all event domains are present
    assert "event" in context
    assert context["event"]["id"] == sample_event_id
    assert context["event"]["currency"] == "INR"
    assert "budget" in context
    assert "timeline" in context
    assert "vendors" in context
    assert "guests" in context
    assert "inspiration" in context
    assert "recent_dialogue" in context
    assert context.get("current_user_message") == "What should we plan next?"

    # 2. Strict Privacy & Data Minimization Verification:
    # Ensure no guest personal identifying attributes exist in context
    guests_snapshot = context["guests"]
    assert "names" not in guests_snapshot
    assert "emails" not in guests_snapshot
    assert "phones" not in guests_snapshot
    assert "tables" not in guests_snapshot
    assert "accessibility" not in guests_snapshot
    # Verify aggregate dietary metrics only
    assert "dietary_needs" in guests_snapshot
    assert isinstance(guests_snapshot["dietary_needs"], dict)
    assert any("jain" in k.lower() or "veg" in k.lower() for k in guests_snapshot["dietary_needs"].keys())

    # 3. Context Size Limits: ensure serialized context is bounded
    context_str = json.dumps(context)
    # Approx 1 token per 4 characters; verify < 6000 chars (< 1,500 tokens)
    assert len(context_str) < 6000


def test_context_conversation_ordering(db, sample_event_id):
    """Verify recent conversation history in context maintains strict chronological ordering."""
    thread = CopilotThread(event_id=sample_event_id, title="Ordering Thread")
    db.add(thread)
    db.commit()

    base_time = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)
    msg1 = CopilotMessage(thread_id=thread.id, event_id=sample_event_id, role="user", content="Turn 1", created_at=base_time)
    msg2 = CopilotMessage(thread_id=thread.id, event_id=sample_event_id, role="assistant", content="Turn 2", created_at=base_time + timedelta(minutes=1))
    msg3 = CopilotMessage(thread_id=thread.id, event_id=sample_event_id, role="user", content="Turn 3", created_at=base_time + timedelta(minutes=2))
    db.add_all([msg1, msg2, msg3])
    db.commit()

    context = CopilotContextBuilder.build_bounded_context(db, sample_event_id, thread_id=thread.id)
    dialogue = context["recent_dialogue"]
    assert len(dialogue) == 3
    assert dialogue[0]["content"] == "Turn 1"
    assert dialogue[1]["content"] == "Turn 2"
    assert dialogue[2]["content"] == "Turn 3"
