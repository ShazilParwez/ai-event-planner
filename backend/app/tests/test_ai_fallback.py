import asyncio
import time
from decimal import Decimal
import pytest
from unittest.mock import AsyncMock

from app.models.event import EventType
from app.schemas.ai import AICopilotEventGenerationRequest
from app.services.ai.fallback import (
    generate_fallback_full_plan,
    generate_fallback_budget,
    generate_fallback_timeline,
    generate_fallback_vendor_checklists,
    generate_fallback_inspiration,
)
from app.services.ai.orchestrator import AICopilotOrchestrator, CircuitBreaker


def test_fallback_budget_allocations_sum_to_100():
    for event_type in [EventType.WEDDING, EventType.BIRTHDAY, EventType.COMMUNITY, EventType.OTHER]:
        target = Decimal("20000.00")
        budget_plan = generate_fallback_budget(event_type, target, guest_count=100)

        total_pct = sum(alloc.percentage for alloc in budget_plan.allocations)
        assert total_pct == Decimal("100.00")

        total_suggested = sum(alloc.suggested_amount for alloc in budget_plan.allocations)
        assert total_suggested == target


def test_fallback_full_plan_structure():
    req = AICopilotEventGenerationRequest(
        title="Ruby Anniversary",
        event_type=EventType.WEDDING,
        target_budget=Decimal("15000.00"),
        guest_count=75,
        theme="Vintage Romantic",
    )
    plan = generate_fallback_full_plan(req)
    assert plan.source == "deterministic_fallback"
    assert len(plan.budget_breakdown.allocations) > 0
    assert len(plan.timeline_plan.milestones) > 0
    assert len(plan.vendor_checklists) > 0
    assert len(plan.inspiration_ideas) > 0


def test_circuit_breaker_state_transitions():
    cb = CircuitBreaker(failure_threshold=3, reset_timeout=1)
    assert cb.state == "CLOSED"
    assert cb.can_attempt() is True

    # Record 2 failures -> stays CLOSED
    cb.record_failure()
    cb.record_failure()
    assert cb.state == "CLOSED"

    # 3rd failure -> trips to OPEN
    cb.record_failure()
    assert cb.state == "OPEN"
    assert cb.can_attempt() is False

    # After reset timeout, transitions to HALF_OPEN
    time.sleep(1.1)
    assert cb.can_attempt() is True
    assert cb.state == "HALF_OPEN"

    # Success in HALF_OPEN resets to CLOSED
    cb.record_success()
    assert cb.state == "CLOSED"
    assert cb.failure_count == 0


def test_orchestrator_mock_mode():
    orchestrator = AICopilotOrchestrator()
    req = AICopilotEventGenerationRequest(
        title="Community Harvest Festival",
        event_type=EventType.COMMUNITY,
        target_budget=Decimal("8000.00"),
        guest_count=150,
    )
    plan = asyncio.run(orchestrator.generate_full_event_plan(req))
    assert plan is not None
    assert plan.source in ["mock", "deterministic_fallback"]


def test_orchestrator_hang_triggers_deterministic_fallback():
    """Verifies that an AI client call that hangs or exceeds deadline falls back cleanly."""
    orchestrator = AICopilotOrchestrator()
    original_use_mock = orchestrator.settings.USE_MOCK_AI
    original_timeout = orchestrator.settings.AI_REQUEST_TIMEOUT_SECONDS

    try:
        orchestrator.settings.USE_MOCK_AI = False
        orchestrator.settings.AI_REQUEST_TIMEOUT_SECONDS = 0.2

        async def _mock_hanging_call(*args, **kwargs):
            await asyncio.sleep(20.0)

        orchestrator.gemini_client.generate_full_event_plan = _mock_hanging_call

        req = AICopilotEventGenerationRequest(
            title="Hanging Call Event",
            event_type=EventType.BIRTHDAY,
            target_budget=Decimal("5000.00"),
            guest_count=20,
        )

        start = time.time()
        plan = asyncio.run(orchestrator.generate_full_event_plan(req))
        elapsed = time.time() - start

        assert elapsed < 1.0 # Bounded prompt fallback within deadline
        assert plan is not None
        assert plan.source == "deterministic_fallback"
        assert orchestrator.circuit_breaker.failure_count >= 1
    finally:
        orchestrator.settings.USE_MOCK_AI = original_use_mock
        orchestrator.settings.AI_REQUEST_TIMEOUT_SECONDS = original_timeout
