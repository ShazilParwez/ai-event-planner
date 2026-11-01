# ADR 0003: AI Orchestration, Bounded Retries, and Deterministic Fallback

## Status
Accepted

## Context
External AI APIs (including Google Gemini) can experience transient network outages, latency spikes, rate limiting, or regional unavailability. An event planning assistant must remain operable by planners even during external connectivity issues.

## Decision
We implemented a multi-tier AI Orchestration layer (`AICopilotOrchestrator`):
1. **Official Google GenAI SDK (`google-genai`)** with structured schema validation (`response_schema`).
2. **Bounded Retries with Exponential Backoff** (max 3 retries, 1-4s wait) and hard 15-second request timeouts.
3. **In-Memory Circuit Breaker**: Trips to `OPEN` after 5 consecutive failures, halting outbound requests for 60 seconds.
4. **Deterministic Rule-Based Fallback**: Domain heuristics generate valid, tailored planning blueprints for Weddings, Birthdays, and Community events when Gemini is unavailable.
5. **Mock Provider**: Enables zero-credential automated testing and offline development.

## Consequences
- **Positive**:
  - Zero application downtime from AI service interruptions.
  - Predictable latency profiles for end-users.
  - Fast, reliable unit and integration tests.
- **Negative**:
  - Requires maintaining domain benchmark rules alongside prompt templates.

