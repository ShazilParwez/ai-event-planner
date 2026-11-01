import time
import asyncio
from decimal import Decimal
from typing import List, Optional
from app.core.config import get_settings
from app.core.logging import logger
from app.models.event import EventType
from app.schemas.ai import (
    AICopilotEventGenerationRequest,
    AICopilotFullPlanResponse,
    AIBudgetPlanResponse,
    AITimelinePlanResponse,
    AICopilotChatRequest,
    AICopilotChatResponse,
    AIInspirationIdea,
)
from app.services.ai.interface import AIAssistantInterface
from app.services.ai.mock_client import MockAIAssistantClient
from app.services.ai.gemini_client import GeminiAIAssistantClient
from app.services.ai.fallback import (
    generate_fallback_full_plan,
    generate_fallback_budget,
    generate_fallback_timeline,
    generate_fallback_inspiration,
    generate_fallback_chat_reply,
)


class CircuitBreaker:
    """In-memory Circuit Breaker to guard against cascading AI provider outages."""

    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self) -> None:
        if self.state != "CLOSED":
            logger.info(f"[CircuitBreaker] Transition: {self.state} -> CLOSED. AI Provider service recovered.")
        self.failure_count = 0
        self.state = "CLOSED"

    def record_failure(self, error: Optional[Exception] = None) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()
        error_name = error.__class__.__name__ if error else "ProviderError"
        if self.failure_count >= self.failure_threshold and self.state != "OPEN":
            self.state = "OPEN"
            logger.error(
                f"[CircuitBreaker] Transition: CLOSED -> OPEN after {self.failure_count} consecutive failures "
                f"(latest error: {error_name}). Cool-down reset timeout: {self.reset_timeout}s."
            )
        else:
            logger.warning(
                f"[CircuitBreaker] Failure #{self.failure_count}/{self.failure_threshold} recorded ({error_name})."
            )

    def can_attempt(self) -> bool:
        if self.state == "CLOSED":
            return True
        if self.state == "OPEN":
            elapsed = time.time() - self.last_failure_time
            if elapsed >= self.reset_timeout:
                self.state = "HALF_OPEN"
                logger.info(f"[CircuitBreaker] Transition: OPEN -> HALF_OPEN ({elapsed:.1f}s elapsed). Canary probe authorized.")
                return True
            logger.warning(
                f"[CircuitBreaker] Request rejected: Circuit is OPEN ({self.failure_count} consecutive failures). "
                f"Reset in {max(0, self.reset_timeout - elapsed):.1f}s."
            )
            return False
        if self.state == "HALF_OPEN":
            return True
        return False


class AICopilotOrchestrator:
    """Central AI Orchestration layer with provider routing, circuit breaking, and deterministic fallback."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.mock_client = MockAIAssistantClient()
        self.gemini_client = GeminiAIAssistantClient()
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=self.settings.AI_CIRCUIT_BREAKER_FAILURES,
            reset_timeout=self.settings.AI_CIRCUIT_BREAKER_RESET_SECONDS,
        )

    @property
    def mode(self) -> str:
        if self.settings.USE_MOCK_AI:
            return "mock"
        if not self.gemini_client.is_available:
            return "fallback"
        return "gemini"

    @property
    def circuit_breaker_state(self) -> str:
        return self.circuit_breaker.state

    async def generate_full_event_plan(
        self, request: AICopilotEventGenerationRequest
    ) -> AICopilotFullPlanResponse:
        op = "generate_full_event_plan"
        start_t = time.perf_counter()

        if self.settings.USE_MOCK_AI:
            logger.info(f"[AI Orchestrator] Routing '{op}' to Mock provider.")
            res = await self.mock_client.generate_full_event_plan(request)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Mock '{op}' completed in {dur_ms:.1f}ms.")
            return res

        if not self.circuit_breaker.can_attempt():
            logger.warning(f"[AI Fallback] Circuit Breaker OPEN. Activating deterministic fallback for '{op}'.")
            return generate_fallback_full_plan(request)

        logger.info(f"[AI Orchestrator] Routing '{op}' to Gemini provider (model: {self.settings.GEMINI_MODEL}).")
        timeout = float(self.settings.AI_REQUEST_TIMEOUT_SECONDS)
        try:
            plan = await asyncio.wait_for(
                self.gemini_client.generate_full_event_plan(request),
                timeout=timeout,
            )
            self.circuit_breaker.record_success()
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Gemini '{op}' completed in {dur_ms:.1f}ms.")
            return plan
        except Exception as exc:
            self.circuit_breaker.record_failure(exc)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.warning(
                f"[AI Fallback] Gemini API failure in '{op}' after {dur_ms:.1f}ms ({exc.__class__.__name__}: {str(exc)[:100]}). "
                "Activating deterministic fallback."
            )
            return generate_fallback_full_plan(request)

    async def generate_budget_breakdown(
        self, event_type: EventType, target_budget: Decimal, guest_count: int
    ) -> AIBudgetPlanResponse:
        op = "generate_budget_breakdown"
        start_t = time.perf_counter()

        if self.settings.USE_MOCK_AI:
            logger.info(f"[AI Orchestrator] Routing '{op}' to Mock provider.")
            res = await self.mock_client.generate_budget_breakdown(event_type, target_budget, guest_count)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Mock '{op}' completed in {dur_ms:.1f}ms.")
            return res

        if not self.circuit_breaker.can_attempt():
            logger.warning(f"[AI Fallback] Circuit Breaker OPEN. Activating deterministic fallback for '{op}'.")
            return generate_fallback_budget(event_type, target_budget, guest_count)

        logger.info(f"[AI Orchestrator] Routing '{op}' to Gemini provider (model: {self.settings.GEMINI_MODEL}).")
        timeout = float(self.settings.AI_REQUEST_TIMEOUT_SECONDS)
        try:
            res = await asyncio.wait_for(
                self.gemini_client.generate_budget_breakdown(event_type, target_budget, guest_count),
                timeout=timeout,
            )
            self.circuit_breaker.record_success()
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Gemini '{op}' completed in {dur_ms:.1f}ms.")
            return res
        except Exception as exc:
            self.circuit_breaker.record_failure(exc)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.warning(
                f"[AI Fallback] Gemini API failure in '{op}' after {dur_ms:.1f}ms ({exc.__class__.__name__}: {str(exc)[:100]}). "
                "Activating deterministic fallback."
            )
            return generate_fallback_budget(event_type, target_budget, guest_count)

    async def generate_timeline(
        self, event_type: EventType, target_date_iso: Optional[str] = None
    ) -> AITimelinePlanResponse:
        op = "generate_timeline"
        start_t = time.perf_counter()

        if self.settings.USE_MOCK_AI:
            logger.info(f"[AI Orchestrator] Routing '{op}' to Mock provider.")
            res = await self.mock_client.generate_timeline(event_type, target_date_iso)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Mock '{op}' completed in {dur_ms:.1f}ms.")
            return res

        if not self.circuit_breaker.can_attempt():
            logger.warning(f"[AI Fallback] Circuit Breaker OPEN. Activating deterministic fallback for '{op}'.")
            return generate_fallback_timeline(event_type)

        logger.info(f"[AI Orchestrator] Routing '{op}' to Gemini provider (model: {self.settings.GEMINI_MODEL}).")
        timeout = float(self.settings.AI_REQUEST_TIMEOUT_SECONDS)
        try:
            res = await asyncio.wait_for(
                self.gemini_client.generate_timeline(event_type, target_date_iso),
                timeout=timeout,
            )
            self.circuit_breaker.record_success()
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Gemini '{op}' completed in {dur_ms:.1f}ms.")
            return res
        except Exception as exc:
            self.circuit_breaker.record_failure(exc)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.warning(
                f"[AI Fallback] Gemini API failure in '{op}' after {dur_ms:.1f}ms ({exc.__class__.__name__}: {str(exc)[:100]}). "
                "Activating deterministic fallback."
            )
            return generate_fallback_timeline(event_type)

    async def generate_inspiration_ideas(
        self, event_type: EventType, theme: Optional[str], category: Optional[str], num_ideas: int = 4
    ) -> List[AIInspirationIdea]:
        op = "generate_inspiration_ideas"
        start_t = time.perf_counter()

        if self.settings.USE_MOCK_AI:
            logger.info(f"[AI Orchestrator] Routing '{op}' to Mock provider.")
            res = await self.mock_client.generate_inspiration_ideas(event_type, theme, category, num_ideas)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Mock '{op}' completed in {dur_ms:.1f}ms.")
            return res

        if not self.circuit_breaker.can_attempt():
            logger.warning(f"[AI Fallback] Circuit Breaker OPEN. Activating deterministic fallback for '{op}'.")
            return generate_fallback_inspiration(event_type, theme)

        logger.info(f"[AI Orchestrator] Routing '{op}' to Gemini provider (model: {self.settings.GEMINI_MODEL}).")
        timeout = float(self.settings.AI_REQUEST_TIMEOUT_SECONDS)
        try:
            res = await asyncio.wait_for(
                self.gemini_client.generate_inspiration_ideas(event_type, theme, category, num_ideas),
                timeout=timeout,
            )
            self.circuit_breaker.record_success()
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Gemini '{op}' completed in {dur_ms:.1f}ms.")
            return res
        except Exception as exc:
            self.circuit_breaker.record_failure(exc)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.warning(
                f"[AI Fallback] Gemini API failure in '{op}' after {dur_ms:.1f}ms ({exc.__class__.__name__}: {str(exc)[:100]}). "
                "Activating deterministic fallback."
            )
            return generate_fallback_inspiration(event_type, theme)

    async def chat_copilot(
        self, request: AICopilotChatRequest, event_context: dict
    ) -> AICopilotChatResponse:
        op = "chat_copilot"
        start_t = time.perf_counter()

        if self.settings.USE_MOCK_AI:
            logger.info(f"[AI Orchestrator] Routing '{op}' to Mock provider.")
            res = await self.mock_client.chat_copilot(request, event_context)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Mock '{op}' completed in {dur_ms:.1f}ms.")
            return res

        if not self.circuit_breaker.can_attempt():
            logger.warning(f"[AI Fallback] Circuit Breaker OPEN. Activating deterministic fallback for '{op}'.")
            return generate_fallback_chat_reply(request, event_context)

        logger.info(f"[AI Orchestrator] Routing '{op}' to Gemini provider (model: {self.settings.GEMINI_MODEL}).")
        timeout = float(self.settings.AI_REQUEST_TIMEOUT_SECONDS)
        try:
            res = await asyncio.wait_for(
                self.gemini_client.chat_copilot(request, event_context),
                timeout=timeout,
            )
            self.circuit_breaker.record_success()
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"[AI Orchestrator] Gemini '{op}' completed in {dur_ms:.1f}ms.")
            return res
        except Exception as exc:
            self.circuit_breaker.record_failure(exc)
            dur_ms = (time.perf_counter() - start_t) * 1000
            logger.warning(
                f"[AI Fallback] Gemini API failure in '{op}' after {dur_ms:.1f}ms ({exc.__class__.__name__}: {str(exc)[:100]}). "
                "Activating deterministic fallback."
            )
            return generate_fallback_chat_reply(request, event_context)
