import json
import asyncio
import time
from decimal import Decimal
from typing import List, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
    retry_if_exception,
)

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
    AIInspirationIdeasWrapper,
)
from app.services.ai.interface import AIAssistantInterface


def is_recoverable_ai_error(exception: BaseException) -> bool:
    """
    Determines if an AI provider exception is transient and recoverable.
    Non-recoverable errors (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found)
    must NOT be retried to avoid burning quota or delaying fallback.
    Recoverable errors (429 Rate Limit, 500/503 Server Errors, Network Timeouts) are retried.
    """
    if isinstance(exception, (ValueError, TypeError, KeyError, json.JSONDecodeError)):
        return False

    err_str = str(exception).lower()

    if "401" in err_str or "unauthorized" in err_str or "api_key" in err_str or "invalid api key" in err_str:
        logger.error("Non-recoverable AI error: Invalid or unauthorized API key. Halting retries.")
        return False

    if "403" in err_str or "permission denied" in err_str:
        logger.error("Non-recoverable AI error: Permission denied. Halting retries.")
        return False

    if "400" in err_str or "invalid argument" in err_str or "malformed" in err_str:
        logger.error("Non-recoverable AI error: Malformed request payload. Halting retries.")
        return False

    if "404" in err_str or "not found" in err_str:
        logger.error("Non-recoverable AI error: Model endpoint not found. Halting retries.")
        return False

    # Recoverable conditions: 429 rate limit, 503 unavailable, network timeouts
    if any(k in err_str for k in ["429", "rate limit", "quota", "resource exhausted", "500", "502", "503", "504", "timeout", "temporarily unavailable"]):
        logger.warning(f"Recoverable AI transient error detected: {err_str[:120]}. Scheduling retry with jitter.")
        return True

    if isinstance(exception, (asyncio.TimeoutError, TimeoutError, ConnectionError, OSError)):
        logger.warning("Recoverable connection/timeout error. Scheduling retry with jitter.")
        return True

    return False


def log_retry_attempt(retry_state) -> None:
    """Logs transient retry attempts with exponential backoff delay."""
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    exc_name = exc.__class__.__name__ if exc else "Unknown"
    sleep_sec = retry_state.next_action.sleep if retry_state.next_action else 0.0
    logger.warning(
        f"[Gemini AI Retry] Transient failure ({exc_name}). "
        f"Scheduling retry #{retry_state.attempt_number} in {sleep_sec:.2f}s with jitter."
    )


class GeminiAIAssistantClient(AIAssistantInterface):
    """Production client using the official Google GenAI SDK (google-genai)."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        if not self.settings.GEMINI_API_KEY:
            logger.info("GEMINI_API_KEY not configured. Running in Mock/Deterministic fallback mode.")
            return

        try:
            from google import genai
            self._client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
            logger.info("Initialized official Google GenAI SDK client successfully.")
        except ImportError:
            logger.warning("google-genai package not installed. Live client will remain inactive.")
            self._client = None
        except Exception as exc:
            logger.error(f"Failed to initialize Google GenAI SDK: {str(exc)}")
            self._client = None

    @property
    def is_available(self) -> bool:
        return self._client is not None

    async def _execute_generate_content(self, prompt: str, response_schema=None) -> str:
        """Helper to run GenAI generation inside asyncio timeout with bounded retries and exponential jitter.
        Enforces a strict total operation deadline of AI_REQUEST_TIMEOUT_SECONDS (15s) including all retries and backoff.
        """
        if not self.is_available:
            raise RuntimeError("Gemini client is uninitialized or API key is missing.")

        loop = asyncio.get_running_loop()
        total_deadline = float(self.settings.AI_REQUEST_TIMEOUT_SECONDS)
        per_attempt_timeout = min(7.0, total_deadline / 2.0)

        def _call_gemini():
            config = {}
            if response_schema:
                config["response_mime_type"] = "application/json"
                config["response_schema"] = response_schema

            start_t = time.perf_counter()
            response = self._client.models.generate_content(
                model=self.settings.GEMINI_MODEL,
                contents=prompt,
                config=config if config else None,
            )
            elapsed_ms = (time.perf_counter() - start_t) * 1000

            usage = getattr(response, "usage_metadata", None)
            if usage:
                prompt_tokens = getattr(usage, "prompt_token_count", None)
                candidates_tokens = getattr(usage, "candidates_token_count", None)
                total_tokens = getattr(usage, "total_token_count", None)
                logger.info(
                    f"[Gemini AI] Generation succeeded in {elapsed_ms:.1f}ms (model: {self.settings.GEMINI_MODEL}). "
                    f"Tokens: prompt={prompt_tokens}, candidates={candidates_tokens}, total={total_tokens}"
                )
            else:
                logger.info(
                    f"[Gemini AI] Generation succeeded in {elapsed_ms:.1f}ms (model: {self.settings.GEMINI_MODEL}). "
                    "(Usage metadata not provided by provider)"
                )
            return response.text

        # Bounded retry with randomized exponential backoff and jitter (e.g. 1s - 3s)
        # Filters out 401/403/400 non-recoverable errors
        @retry(
            reraise=True,
            stop=stop_after_attempt(self.settings.AI_MAX_RETRIES),
            wait=wait_random_exponential(multiplier=0.5, min=1, max=3),
            retry=retry_if_exception(is_recoverable_ai_error),
            before_sleep=log_retry_attempt,
        )
        async def _call_with_retry():
            return await asyncio.wait_for(
                loop.run_in_executor(None, _call_gemini),
                timeout=per_attempt_timeout,
            )

        # Enforce genuine total operation deadline including all retries and backoff
        return await asyncio.wait_for(_call_with_retry(), timeout=total_deadline)

    async def generate_full_event_plan(
        self, request: AICopilotEventGenerationRequest
    ) -> AICopilotFullPlanResponse:
        prompt = (
            f"You are an expert event architect in India. Create a structured planning blueprint for a "
            f"{request.event_type.value} titled '{request.title}'. Target budget: INR {request.target_budget}. "
            f"Guest count: {request.guest_count}. Location: {request.location or 'India'}. "
            f"Theme: {request.theme or 'Festive & Elegant'}. Notes: {request.notes or 'None'}. "
            f"Do not fabricate fictional vendor pricing or guaranteed availability. Provide realistic percentage allocations."
        )

        raw_json = await self._execute_generate_content(prompt, response_schema=AICopilotFullPlanResponse)
        parsed_data = json.loads(raw_json)
        response = AICopilotFullPlanResponse.model_validate(parsed_data)
        response.source = "gemini"
        return response

    async def generate_budget_breakdown(
        self, event_type: EventType, target_budget: Decimal, guest_count: int
    ) -> AIBudgetPlanResponse:
        prompt = (
            f"Generate a realistic category budget allocation breakdown for an Indian {event_type.value} "
            f"with a target budget of INR {target_budget} and an estimated guest count of {guest_count}. "
            f"Ensure allocations sum to exactly 100% and include practical cost-saving tips."
        )

        raw_json = await self._execute_generate_content(prompt, response_schema=AIBudgetPlanResponse)
        parsed_data = json.loads(raw_json)
        return AIBudgetPlanResponse.model_validate(parsed_data)

    async def generate_timeline(
        self, event_type: EventType, target_date_iso: Optional[str]
    ) -> AITimelinePlanResponse:
        prompt = (
            f"Create a comprehensive planning milestone roadmap and sample day-of itinerary for an Indian "
            f"{event_type.value}. Target date: {target_date_iso or 'Flexible'}."
        )

        raw_json = await self._execute_generate_content(prompt, response_schema=AITimelinePlanResponse)
        parsed_data = json.loads(raw_json)
        return AITimelinePlanResponse.model_validate(parsed_data)

    async def generate_inspiration_ideas(
        self, event_type: EventType, theme: Optional[str], category: Optional[str], num_ideas: int
    ) -> List[AIInspirationIdea]:
        prompt = (
            f"Generate {num_ideas} creative inspiration ideas for an Indian {event_type.value} "
            f"with theme '{theme or 'Traditional Meets Contemporary'}'. "
            f"Category focus: {category or 'General (decor, activities, themes, catering, entertainment)'}. "
            f"For each idea, provide a vivid title, description, category, theme tags, color palette (hex codes), "
            f"and an indicative suggested budget range (e.g., '₹50,000 - ₹1,00,000 (Indicative)')."
        )

        raw_json = await self._execute_generate_content(prompt, response_schema=AIInspirationIdeasWrapper)
        parsed_data = json.loads(raw_json)
        return [AIInspirationIdea.model_validate(i) for i in parsed_data.get("ideas", [])]

    async def chat_copilot(
        self, request: AICopilotChatRequest, event_context: dict
    ) -> AICopilotChatResponse:
        prompt = (
            f"You are the senior AI Event Planning Copilot for Indian events (weddings, birthdays, community celebrations). "
            f"Active Event Context:\n{json.dumps(event_context, indent=2)}\n\n"
            f"User Inquiry:\n{request.message}\n\n"
            f"Instructions:\n"
            f"1. Provide empathetic, practical, and highly context-aware advice in Markdown format.\n"
            f"2. If the user mentions creating or adjusting something (e.g. milestones, budget expenses, or vendor items), "
            f"propose 1-2 structured actions in 'proposed_actions' with action_type, title, description, and valid schema parameters. "
            f"Supported action_types: ADD_TIMELINE_MILESTONE, ADD_BUDGET_EXPENSE, ADD_VENDOR_ITEM. "
            f"Never assume an action is executed; they remain PENDING until the user approves them.\n"
            f"3. Check for risks: if the budget is over or tight, if milestones are overdue, or if vendors are uncommitted, generate appropriate 'warnings'.\n"
            f"4. Provide 2-3 short interactive follow-up prompt chips in 'suggested_prompts'.\n"
        )

        raw_json = await self._execute_generate_content(prompt, response_schema=AICopilotChatResponse)
        parsed_data = json.loads(raw_json)
        res = AICopilotChatResponse.model_validate(parsed_data)
        res.source = "gemini"
        if not res.suggested_actions:
            res.suggested_actions = [p.title for p in res.proposed_actions] or res.suggested_prompts
        return res
