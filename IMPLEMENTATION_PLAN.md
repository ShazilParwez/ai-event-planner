# Project Roadmap & Implementation Plan: AI Event Planner

## Phase Status Overview

| Phase | Description | Status | Verification Status |
|---|---|---|---|
| **Phase 1** | Project Foundation & Architecture Audit | **Completed** | Full Decoupled Monorepo & Baseline Schemas |
| **Phase 1.1** | Architecture Verification & INR Localization | **Completed** | INR Default, 15s Deadline, Alembic 001 |
| **Phase 2** | Core Event & Budget Management | **Completed** | Backend CRUD + UI Ledger + 26/26 Pytest + 12/12 Vitest |
| **Phase 3** | Timeline Management & Vendor Pipelines | **Completed** | Full Timeline + Vendor Backend & UI + 53/53 Pytest + 20/20 Vitest |
| **Phase 4** | Guest Roster & Inspiration Studio | **Completed** | Full Guest + Inspiration Backend & UI + 64/64 Pytest + 29/29 Vitest |
| **Phase 5** | AI Copilot Chat & Interactive Features | *Planned* | Contracts Defined |
| **Phase 6** | Production Hardening & Final Polishing | *Planned* | Scheduled |

---

## Phase 2 Completed Deliverables

### 1. Pre-Implementation Refinements
- **15-Second Hard Operation Deadline**: Total operation deadline (inclusive of all bounded retries and exponential backoff) strictly enforced in `GeminiAIAssistantClient` and `AICopilotOrchestrator`. Promptly activates deterministic fallback upon timeout.
- **ISO 4217 Currency Standard**: Validates 3-letter uppercase currency code (e.g., `INR`, `USD`, `EUR`) with `INR` as default. Formatted across all screens using `Intl.NumberFormat` without hardcoded symbols.

### 2. Event Management Backend & UI
- **Database Model**: Extended with `description`, `start_date`, `end_date`, `expected_guest_count`, and `OTHER` event type via Alembic migration `002_add_event_fields`.
- **Backend Service**: Implemented complete CRUD, filtering (by event type and status), case-insensitive search, and offset/limit + page-based pagination.
- **Frontend Hub**: Complete Event Hub with Event Cards grid, Create/Edit modals with field validation, cascade Delete confirmation modal, and global active event switcher.

### 3. Budget Intelligence Backend & UI
- **Deterministic Math Engine**: Computes target budget, allocated funds, estimated costs, actual expenditures, cash paid, remaining budget, category utilization %, and over-budget flag using exact fixed-point `Decimal`.
- **Pre-seeded Suggested Categories**: One-click seeding of 9 standard industry categories with proportional target allocations.
- **Category & Item CRUD**: Cross-event isolation guarantees items cannot be attached or moved across different events. Safe category deletion prevents accidental removal of categories containing items.
- **Frontend Ledger**: Overview KPI metric cards, prominent Over-Budget Warning Banner, Category progress bars with utilization indicators, and full granular expenses table with status badges (`ESTIMATED`, `PENDING`, `PAID`).

### 4. Verification & Testing
- **Backend Test Suite**: **26/26 tests passed** (1.70s) covering event CRUD, currency validation, date ordering, category safety, seeding, cross-event isolation, and exact Decimal math.
- **Frontend Test Suite**: **12/12 Vitest tests passed** (3.87s) covering App navigation, Event management modal validation, Budget KPI rollups, over-budget alerts, and payment consistency.
- **Frontend Build**: Zero TypeScript errors (`tsc --noEmit`), production bundle compiled via `pnpm run build` in 3.89s.

---

## Phase 3 Completed Deliverables

### 1. Database Schema Enhancements (Alembic Migration 004)
- **`004_timeline_and_vendor_enhancements`**:
  - `timeline_milestones`: added `priority` (String 50, default `'MEDIUM'`) and `description` (Text, nullable).
  - `timeline_activities`: added `order_index` (Integer, default 0) and `description` (Text, nullable).
  - `vendor_items`: added `location` (String 255, nullable), `website` (String 255, nullable), and `advance_paid` (Numeric 12,2, default 0.00).

### 2. Timeline Management Backend & UI
- **Backend Service (`TimelineService`)**:
  - Deterministic overview rollups: `total_milestones`, `completed_milestones`, `completion_percentage`, and dynamic `overdue_milestones`.
  - Milestones CRUD with phase categorization (`BEFORE_EVENT`, `WEEK_OF`, `DAY_OF`, `AFTER_EVENT`), priority weighting (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and completion status toggles.
  - Template milestone seeding tailored to event types (Weddings, Birthdays, Community, Other).
  - Day-of minute-by-minute activity run-of-show scheduling with `start_time <= end_time` validation and sequence ordering.
  - Strict cross-event isolation on all milestone and activity operations.
- **Frontend UI (`TimelineView`, `MilestoneModal`, `ActivityModal`)**:
  - Dual-mode view: **Milestones Roadmap** and **Day-of Schedule (Run of Show)**.
  - Milestone cards grouped by phase with overdue badges, priority indicators, completion checkboxes, and quick edit/delete actions.
  - Activity run-of-show list sorted chronologically with time intervals, locations, and completion status.
  - One-click template generator button to seed initial milestones for newly created events.

### 3. Vendor Management Backend & UI
- **Backend Service (`VendorService`)**:
  - Vendor procurement pipeline tracking: `RESEARCHING`, `CONTACTED`, `QUOTED`, `BOOKED`, `COMPLETED`.
  - Deterministic financial rollups using Python `Decimal`: `total_quoted`, `total_agreed`, `advance_paid`, and `remaining_payment`.
  - Invariant validation: `advance_paid <= contracted_amount` strictly validated in Pydantic schema and service layers.
  - Vendor category seeding with standard event categories and Lucide icon mappings.
  - Strict cross-event isolation on all vendor queries and mutations.
- **Frontend UI (`VendorView`, `VendorModal`)**:
  - Dual-mode view: **Vendor Directory** (filterable by category and status) and **Procurement Pipeline** (Kanban-style status board).
  - KPI overview metrics cards: Total Quoted, Total Contracted, Advance Paid, Remaining Balance, and Booked Vendors count.
  - Responsive vendor cards displaying contact cards (phone, email, website, location), pricing breakdown, and quick status advancement.
  - Comprehensive Add/Edit Vendor modal with auto-calculation of remaining balance.

### 4. Verification & Testing
- **Backend Test Suite**: **53/53 passed** (100% pass rate across 10 test modules) including 12 dedicated Phase 3 tests covering milestones CRUD, overdue logic, activity timing validation, vendor pipeline transitions, advance payment limits, and cross-event isolation.
- **Frontend Test Suite**: **20/20 passed** (100% pass rate across 5 test suites) including 4 unit tests for Timeline Management and 4 unit tests for Vendor Management.
- **Type Checking**: Strict TypeScript check (`pnpm run typecheck`) exited with **0 errors**.
- **Production Build**: Production bundle compiled via `pnpm run build` in 3.82s without warnings or chunks errors.
- **End-to-End Verification (Playwright)**: Full browser verification against running backend and frontend with **0 console errors** and **0 network failures**, capturing 4 verified screenshots:
  - `07_timeline_roadmap.png`
  - `08_day_of_schedule.png`
  - `09_vendor_directory.png`
  - `10_vendor_pipeline.png`

---

## Phase 4 Completed Deliverables

### 1. Database Schema Enhancements (Alembic Migration 005)
- **`005_guest_and_inspiration_enhancements`**:
  - `guests`: added `category` (String 50, default `'Friends'`), `invitation_status` (String 50, default `'NOT_SENT'`), `accessibility_requirements` (Text, nullable), and `dietary_preferences` (String 255, nullable).
  - `inspiration_cards`: added `color_palette` (Text, JSON array of hex codes), `suggested_budget_range` (String 255, indicative estimates), `notes` (Text, nullable), and `source_type` (String 50, default `'AI_GENERATED'`).

### 2. Guest Management Backend & UI
- **Backend Service (`GuestService`)**:
  - Full CRUD operations with search (name, email, phone, table), category filtering (Family, Friends, Colleagues, VIP, Community, Other), and RSVP filtering (INVITED, CONFIRMED, DECLINED, MAYBE, WAITING).
  - Deterministic analytics: `expected_attendance = confirmed_guests + confirmed_plus_ones`, `total_invited`, `pending_responses`, `maybe_responses`, `attendance_rate`.
  - Dynamic catering dietary matrix counting specific preferences (Vegetarian, Vegan, Jain, Gluten-Free, Halal, Nut Allergies).
  - Accessibility requirements tracking for step-free seating and mobility aids.
  - Quick patch endpoints for RSVP and invitation status transitions.
  - Strict cross-event tenant isolation.
- **Frontend UI (`GuestView`, `GuestModal`, `GuestAnalyticsCards`, `GuestDirectoryTable`)**:
  - Top KPI cards: Total Guests, Expected Heads, Pending RSVP, Maybe responses, Declined.
  - Catering Dietary Matrix banner with badge chips for each dietary accommodation.
  - Interactive directory table with search, category pills, RSVP filter, quick RSVP changer, and invitation status toggle.
  - Accessible Add/Edit modal with full contact, dietary, accessibility, and table inputs.

### 3. Inspiration Studio Backend & UI
- **Backend Service (`InspirationService`)**:
  - Full CRUD operations across 9 categories (`Event Themes`, `Decorations`, `Color Palettes`, `Catering and Menus`, `Entertainment`, `Photography Concepts`, `Invitations`, `Activities`, `Other`).
  - Swatch presentation of color palettes with JSON hex arrays, theme tags, and notes.
  - Indicative budget estimates clearly demarcated as non-binding directional guidelines.
  - Save/unsave bookmark toggle state for active event moodboard.
- **Gemini Creative Integration**:
  - Dedicated generation service using official Google GenAI SDK (`gemini-2.5-flash`).
  - Structured output schema validation (`response_schema=AIInspirationIdeasWrapper`).
  - 15-second total AI operation deadline with bounded retries and exponential jitter.
  - Autonomous fallback failover to curated benchmark collections if offline or throttled.
  - "Review Before Saving" pattern: candidate ideas returned for user review without automatically overwriting existing moodboards.
  - Clear attribution: `source_type` tracks `USER` vs. `AI_GENERATED`.
- **Frontend UI (`InspirationView`, `InspirationCardItem`, `InspirationCardModal`, `GenerateInspirationModal`)**:
  - Responsive moodboard gallery grid with category navigation pills and Saved Only filter.
  - Rich card items with category badge, AI vs User pill, color palette circles, indicative budget tags with disclaimers, and bookmark buttons.
  - Dedicated AI Generator modal with category focus, custom prompt, and candidate cards review before saving.

### 4. Verification & Testing
- **Backend Test Suite**: **64/64 passed** (100% pass rate across 11 test modules) including 11 dedicated Phase 4 tests covering guest CRUD, party count calculation, RSVP transitions, search & filtering, deterministic analytics, cross-event isolation, inspiration CRUD, category filtering, AI generation, and fallback behavior.
- **Frontend Test Suite**: **29/29 passed** (100% pass rate across 7 test suites) including 4 unit tests for Guest Management and 5 unit tests for Inspiration Studio.
- **Type Checking**: Strict TypeScript check (`pnpm run lint`) exited with **0 errors**.
- **Production Build**: Production bundle compiled via `pnpm run build` in 4.42s without warnings or chunk errors.
- **End-to-End Verification (Playwright)**: Full browser verification against running backend and frontend with **0 console errors** and **0 network failures**, capturing 4 verified screenshots:
  - `11_guest_management.png`
  - `12_guest_roster_filtered.png`
  - `13_inspiration_studio.png`
  - `14_inspiration_detail.png`

---

## Phase 5B: AI Event Copilot - Backend and AI Infrastructure (Completed)

### 1. Database Persistence & Models (Alembic Migration 006)
- Created `copilot_threads`, `copilot_messages`, and `copilot_actions` tables with foreign keys to `events.id`, `ondelete="CASCADE"`, and appropriate indexes.
- Models `CopilotThread`, `CopilotMessage`, and `CopilotAction` in `backend/app/models/copilot.py` with enums `CopilotRole`, `CopilotActionType`, and `CopilotActionStatus`.
- Integrated cascade relationships into `Event` model in `backend/app/models/event.py`.
- Alembic revision `006_copilot_conversation_persistence (head)` applied and verified.

### 2. Context Construction & Data Minimization (`CopilotContextBuilder`)
- Implemented `CopilotContextBuilder.build_bounded_context(db, event_id, thread_id)`.
- Assembles bounded context payload (1,200–1,500 tokens): event metadata, budget burn overview, pending milestones, vendor bookings, aggregated guest headcount & dietary distributions, saved inspiration moodboard concepts, and rolling 6-message dialogue history.
- Strictly minimizes sensitive personal data: zero guest names, emails, phones, or individual medical strings.

### 3. Structured Gemini & Fallback Responses
- Extended `GeminiAIAssistantClient.chat_copilot` with structured prompt instructions for Markdown advice, contextual warnings, interactive follow-up prompt chips, and actionable mutations.
- Updated `MockAIAssistantClient.chat_copilot` to emit deterministic test actions and responses.
- Enhanced `generate_fallback_chat_reply` in `fallback.py` to evaluate event context (over-budget, overdue milestones) and generate contextual alerts and actionable proposals.

### 4. Safe Interactive Action Execution Lifecycle (`CopilotService`)
- Implemented `CopilotService` managing thread CRUD, message persistence, bounded context assembly, and safe action execution.
- Gemini operates strictly as an advisor with **zero direct database writes**.
- Mutations are stored with `status="PENDING"`.
- Execution endpoint (`POST /events/{id}/copilot/actions/{aid}/execute`) re-validates parameters via Pydantic and routes exclusively through verified domain services (`TimelineService`, `BudgetService`, `VendorService`, `GuestService`, `InspirationService`).
- Strict safeguards: duplicate execution prevention, dismissal lifecycle (`DISMISSED`), and cross-event isolation.

### 5. Verification & Testing
- **Backend Test Suite**: **72/72 passed** (100% pass rate across 12 test modules) including 8 dedicated Phase 5 tests in `test_copilot_phase5.py`.
- **Frontend Test Suite**: **29/29 passed** (100% pass rate across 7 test suites).
- **TypeScript**: Strict compile check (`tsc --noEmit`) exited with **0 errors**.
- **Production Build**: Production bundle compiled via `pnpm run build` in 3.10s.
