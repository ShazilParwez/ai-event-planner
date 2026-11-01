# REST API Specification: AI Event Planner (v1)

Base URL: `/api/v1`

All responses follow the unified envelope:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "errors": null
}
```

---

## 1. System Health & Probes

### 1.1 `GET /api/v1/healthz`
- **Purpose**: Liveness probe for Docker container orchestrator.
- **Request**: No parameters.
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "environment": "development",
  "database_connected": true,
  "ai_provider_mode": "mock",
  "ai_circuit_breaker": "CLOSED",
  "version": "0.1.0"
}
```

### 1.2 `GET /api/v1/readyz`
- **Purpose**: Readiness probe verifying database connectivity and AI engine status.
- **Response**: `200 OK` (or `503 Service Unavailable` if database check fails).

---

## 2. Event Management

### 2.1 `POST /api/v1/events`
- **Description**: Creates a new event record.
- **Request Body**:
```json
{
  "title": "Aarav & Priya's Wedding",
  "event_type": "WEDDING",
  "description": "Grand royal heritage wedding in Udaipur",
  "location": "Udaipur, Rajasthan",
  "start_date": "2026-11-20T10:00:00Z",
  "end_date": "2026-11-22T22:00:00Z",
  "expected_guest_count": 350,
  "target_budget": 3500000.00,
  "currency": "INR",
  "status": "PLANNING"
}
```
- **Validation Rules**:
  - `title` or `name`: String, min 2, max 255 chars.
  - `event_type`: Enum (`WEDDING`, `BIRTHDAY`, `COMMUNITY`, `OTHER`).
  - `target_budget` / `total_budget`: Decimal $\ge 0.00$.
  - `expected_guest_count`: Integer $\ge 0$.
  - `currency`: 3-letter uppercase ISO 4217 code (default `INR`).
  - `start_date` and `end_date`: `end_date >= start_date`.
- **Response**: `201 Created`

### 2.2 `GET /api/v1/events`
- **Description**: Lists events with optional filtering and search.
- **Query Parameters**:
  - `skip`: Integer $\ge 0$ (default 0).
  - `limit`: Integer $1 \dots 100$ (default 50).
  - `event_type`: Optional string filter (`WEDDING`, `BIRTHDAY`, `COMMUNITY`, `OTHER`).
  - `status`: Optional string filter (`PLANNING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  - `search`: Case-insensitive text match on title, description, or location.

### 2.3 `GET /api/v1/events/paginated`
- **Description**: Paginated list returning `items`, `total`, `page`, `page_size`, and `total_pages`.

### 2.4 `GET /api/v1/events/{event_id}`
- **Description**: Retrieves single event by ID or returns `404 Not Found`.

### 2.5 `PUT /api/v1/events/{event_id}`
- **Description**: Updates event properties with full field-level validation.

### 2.6 `DELETE /api/v1/events/{event_id}`
- **Description**: Deletes event and cascades to all associated categories, items, and records.

---

## 3. Budget Intelligence

### 3.1 `GET /api/v1/events/{event_id}/budget`
- **Description**: Deterministic mathematical breakdown of event budget, allocations, costs, and variance.
- **Response**: `200 OK`
```json
{
  "event_id": "308ee6f5-...",
  "target_budget": "3500000.00",
  "total_allocated": "3500000.00",
  "total_estimated": "2850000.00",
  "total_actual": "2950000.00",
  "total_paid": "1500000.00",
  "remaining_budget": "550000.00",
  "variance": "550000.00",
  "is_over_budget": false,
  "currency": "INR",
  "categories": [ ... ]
}
```

### 3.2 Category Endpoints
- `GET /api/v1/events/{event_id}/budget/categories`: List categories for event.
- `POST /api/v1/events/{event_id}/budget/categories`: Create category (`name`, `allocated_amount`, `percentage_target`).
- `PUT /api/v1/events/{event_id}/budget/categories/{category_id}`: Update category.
- `DELETE /api/v1/events/{event_id}/budget/categories/{category_id}?force=false`: Safe delete category. Rejects deletion if items exist unless `force=true`.
- `POST /api/v1/events/{event_id}/budget/categories/seed`: Seed standard industry categories (Venue, Catering, Decor, etc.) calculated against total budget.

### 3.3 Expense Item Endpoints
- `GET /api/v1/events/{event_id}/budget/items?category_id=...`: List expense items for an event.
- `POST /api/v1/events/{event_id}/budget/items`: Add expense item with cross-event category validation.
- `PUT /api/v1/events/{event_id}/budget/items/{item_id}`: Update expense item.
- `DELETE /api/v1/events/{event_id}/budget/items/{item_id}`: Delete expense item.

---

## 4. Timeline Management

### 4.1 `GET /api/v1/events/{event_id}/timeline`
- **Description**: Returns deterministic timeline overview, total/completed/pending/overdue milestone rollups, and day-of execution itinerary.
- **Response**: `200 OK`
```json
{
  "event_id": "984f2352-...",
  "total_milestones": 8,
  "completed_milestones": 2,
  "pending_milestones": 6,
  "overdue_milestones": 0,
  "completion_percentage": 25.0,
  "milestones": [
    {
      "id": "ms-1",
      "event_id": "984f2352-...",
      "title": "Initial Planning & Budget Strategy",
      "phase": "6_MONTHS_BEFORE",
      "target_date": "2026-05-20T10:00:00Z",
      "due_date": "2026-05-20T10:00:00Z",
      "status": "COMPLETED",
      "priority": "CRITICAL",
      "description": "Define overall event concept, budget limits, and core planning team.",
      "order_index": 0,
      "is_ai_suggested": false,
      "is_completed": true,
      "is_overdue": false,
      "activities": [ ... ]
    }
  ],
  "activities": [ ... ]
}
```

### 4.2 Milestone Endpoints
- `POST /api/v1/events/{event_id}/timeline/milestones`: Create milestone (`title`, `phase`, `target_date`, `due_date`, `priority`, `status`, `description`).
- `POST /api/v1/events/{event_id}/timeline/milestones/seed`: Seed 8 standard industry planning milestones.
- `PUT /api/v1/events/{event_id}/timeline/milestones/{milestone_id}`: Update milestone attributes.
- `DELETE /api/v1/events/{event_id}/timeline/milestones/{milestone_id}`: Delete milestone and cascades to linked activities.

### 4.3 Scheduled Activity Endpoints
- `POST /api/v1/events/{event_id}/timeline/activities`: Schedule minute-by-minute day-of activity (`title`, `start_time`, `end_time`, `responsible_party`, `location`, `status`, `milestone_id`). Validates `end_time >= start_time` and cross-event isolation.
- `PUT /api/v1/events/{event_id}/timeline/activities/{activity_id}`: Update scheduled activity.
- `DELETE /api/v1/events/{event_id}/timeline/activities/{activity_id}`: Delete activity.

---

## 5. Vendor Management

### 5.1 `GET /api/v1/events/{event_id}/vendors`
- **Description**: Returns vendor portfolio summary with exact Decimal financial aggregation and optional category/status filters.
- **Query Parameters**:
  - `category`: Optional string filter (`Venue`, `Catering`, `Photography`, etc.)
  - `status`: Optional string filter (`DISCOVERING`, `CONTACTED`, `QUOTED`, `NEGOTIATING`, `BOOKED`, `CANCELLED`)
- **Response**: `200 OK`
```json
{
  "event_id": "984f2352-...",
  "currency": "INR",
  "total_vendors": 3,
  "booked_vendors": 2,
  "hired_vendors": 2,
  "pending_vendors": 1,
  "total_quoted_amount": "3050000.25",
  "total_agreed_cost": "2530000.75",
  "total_advance_paid": "700000.50",
  "total_remaining_payment": "1830000.25",
  "total_contracted_spend": "2530000.75",
  "items": [ ... ]
}
```

### 5.2 Vendor Directory Endpoints
- `GET /api/v1/vendors/categories`: List vendor categories (auto-seeds standard if empty).
- `POST /api/v1/vendors/categories/seed`: Seed 11 standard vendor categories.
- `GET /api/v1/events/{event_id}/vendors/{vendor_id}`: Retrieve single vendor details.
- `POST /api/v1/events/{event_id}/vendors`: Create vendor entry. Enforces `advance_paid <= (agreed_cost or quoted_cost)`.
- `PUT /api/v1/events/{event_id}/vendors/{vendor_id}`: Update vendor details, booking status, or payment.
- `DELETE /api/v1/events/{event_id}/vendors/{vendor_id}`: Delete vendor entry.

---

## 6. Guest Management Endpoints

### 6.1 Guest Roster & Directory
- `GET /api/v1/events/{event_id}/guests`: List guests for event with pagination (`page`, `page_size`), query search (`search` across name, email, phone, table), category filter (`category`), RSVP status filter (`rsvp_status`), and invitation status filter (`invitation_status`).
- `GET /api/v1/events/{event_id}/guests/analytics`: Returns deterministic guest analytics:
  - `total_guests`, `total_invited`, `confirmed_guests`, `declined_guests`, `pending_responses`, `maybe_responses`
  - `expected_attendance = confirmed_guests + confirmed_plus_ones`
  - `total_plus_ones`, `confirmed_plus_ones`, `attendance_rate`
  - `dietary_preference_distribution`: dynamic counts per dietary need (Vegetarian, Vegan, Jain, Gluten-Free, etc.)
  - `guest_category_distribution`: counts across Family, Friends, Colleagues, VIP, Community, Other
  - `rsvp_status_distribution`: counts across INVITED, CONFIRMED, DECLINED, MAYBE, WAITING
- `GET /api/v1/events/{event_id}/guests/summary`: Backward-compatible summary representation.
- `POST /api/v1/events/{event_id}/guests`: Create guest profile (validates name, non-negative plus-ones, category, RSVP status, invitation status, dietary preferences, accessibility requirements, table assignment, notes).
- `GET /api/v1/events/{event_id}/guests/{guest_id}`: Retrieve a single guest profile.
- `PUT /api/v1/events/{event_id}/guests/{guest_id}`: Update guest profile fields.
- `DELETE /api/v1/events/{event_id}/guests/{guest_id}`: Delete guest from event roster.
- `PATCH /api/v1/events/{event_id}/guests/{guest_id}/rsvp`: Quick update RSVP status (`INVITED`, `CONFIRMED`, `DECLINED`, `MAYBE`, `WAITING`).
- `PATCH /api/v1/events/{event_id}/guests/{guest_id}/invitation`: Quick update invitation status (`NOT_SENT`, `SENT`).

---

## 7. Inspiration Studio Endpoints

### 7.1 Moodboard & Creative Cards
- `GET /api/v1/events/{event_id}/inspiration`: List all inspiration cards for event. Supports optional `category` filtering across 9 categories (`Event Themes`, `Decorations`, `Color Palettes`, `Catering and Menus`, `Entertainment`, `Photography Concepts`, `Invitations`, `Activities`, `Other`) and `is_saved` boolean filter.
- `POST /api/v1/events/{event_id}/inspiration/cards`: Create custom inspiration card with title, category, description, theme tags, color palette hex codes, indicative budget range, notes, and saved status.
- `GET /api/v1/events/{event_id}/inspiration/cards/{card_id}`: Retrieve single inspiration card.
- `PUT /api/v1/events/{event_id}/inspiration/cards/{card_id}`: Update inspiration card fields.
- `DELETE /api/v1/events/{event_id}/inspiration/cards/{card_id}`: Delete inspiration card.
- `PATCH /api/v1/events/{event_id}/inspiration/cards/{card_id}/toggle-save`: Toggle `is_saved` boolean state for event moodboard.

### 7.2 AI Creative Concept Generation
- `POST /api/v1/events/{event_id}/inspiration/generate`: Generates creative concepts using Gemini 2.5 Flash with official Google GenAI SDK, strict Pydantic structured output validation, bounded 15s operation deadline, and autonomous deterministic fallback failover.
  - Request body: `{ "event_id": "...", "category": "Decorations", "custom_prompt": "Royal Rajasthani Mandap", "num_ideas": 4 }`
  - Response: `{ "ideas": [ { "title": "...", "category": "...", "description": "...", "color_palette": [...], "suggested_budget_range": "..." } ], "disclaimer": "Suggested budget ranges and ideas are creative, indicative estimates—not confirmed vendor quotations.", "source": "gemini" | "mock" | "deterministic_fallback" }`
  - **Review Before Saving**: Candidate ideas are returned without immediately overwriting live moodboard cards, allowing users to inspect and save selected concepts.

---

## 8. AI Copilot Multi-Turn Conversation & Safe Action Execution

### 8.1 Multi-Turn Conversation Endpoints
- `GET /api/v1/events/{event_id}/copilot/threads`: List all conversation threads for an event, ordered by most recently updated.
- `POST /api/v1/events/{event_id}/copilot/threads`: Create a fresh conversation thread (`title: Optional[str]`). Returns `201 Created`.
- `GET /api/v1/events/{event_id}/copilot/threads/{thread_id}/messages`: Retrieve chronological message history with embedded proposed action metadata and contextual warnings.
- `POST /api/v1/events/{event_id}/copilot/threads/{thread_id}/messages`: Send user message to AI Copilot. Synthesizes bounded event snapshot (budget burn, timeline milestones, vendor pipeline, guest RSVP/dietary aggregates, moodboard concepts), prompts Gemini with structured response schema, persists user/assistant dialogue turns, records proposed mutations as `PENDING` actions, and returns `AICopilotChatResponse`.
- `DELETE /api/v1/events/{event_id}/copilot/threads/{thread_id}`: Delete conversation thread and cascade-delete messages and actions (`204 No Content`).

### 8.2 Safe Interactive Action Approval Endpoints
- `POST /api/v1/events/{event_id}/copilot/actions/{action_id}/execute` (and alias `POST /api/v1/events/{event_id}/copilot/threads/{thread_id}/actions/{action_id}/execute`): Explicit user approval to apply an AI-suggested mutation. Revalidates parameters via Pydantic, checks event ownership, verifies status is `PENDING`, atomically transitions to `EXECUTING` to prevent concurrent duplicate execution, delegates to domain service (`TimelineService`, `BudgetService`, `VendorService`), marks action `EXECUTED` with timestamp, and returns `CopilotActionExecuteResponse`.
  - Re-executing an already executed action returns `400 Bad Request`.
  - Executing a dismissed action returns `400 Bad Request`.
  - Concurrent duplicate execution returns `409 Conflict`.
  - Cross-event execution attempts return `404 Not Found`.
  - Execution against a non-matching `thread_id` returns `404 Not Found`.
  - If a domain service or database operation fails, the transaction is cleanly rolled back, status is preserved as `PENDING`, `executed_at` remains `None`, and an `HTTP 422 Unprocessable Content` is raised.
- `POST /api/v1/events/{event_id}/copilot/actions/{action_id}/dismiss` (and alias `POST /api/v1/events/{event_id}/copilot/threads/{thread_id}/actions/{action_id}/dismiss`): User dismisses an AI action proposal. Updates action status to `DISMISSED`.
  - Dismissing an executed action returns `400 Bad Request`.

### 8.3 Supported Action Types (Phase 5B.1 Active Registry)
Strictly restricted to the three authorized mutation types:
1. `ADD_TIMELINE_MILESTONE`: Creates milestone in `timeline_milestones` via `TimelineService.create_milestone`.
2. `ADD_BUDGET_EXPENSE`: Creates expense item in `budget_items` and updates Decimal committed spend via `BudgetService.create_expense_item`.
3. `ADD_VENDOR_ITEM`: Creates procurement item in `vendor_items` (enforcing advance payment ceiling) via `VendorService.create_vendor`.

*Note: Proposal or execution of unauthorized action types (`ADD_DAY_OF_ACTIVITY`, `ADD_GUEST_PROFILE`, `SAVE_INSPIRATION_CARD`) is rejected with `400 Bad Request`.*

---

## 9. AI Orchestration & Fallback

- **15-Second Hard Operation Deadline**: The orchestrator strictly bounds all live AI operations (inclusive of retries and backoff) to a genuine 15.0s timeout, promptly falling back to deterministic benchmark generators upon transient provider failures.
- **Provider Circuit Breaker**: Trips to `OPEN` after 5 consecutive transient failures, auto-resetting after 60 seconds of cool-down.
- **Zero Hallucination Guarantee**: Vendor contacts, real pricing, and event calculations remain deterministic; Gemini is used solely for creative inspiration and blueprint recommendations.

