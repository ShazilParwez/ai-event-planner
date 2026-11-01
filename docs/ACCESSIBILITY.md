# Inclusive AI Event Planner: Accessibility System Documentation

## 1. Architectural Overview & Design Philosophy

The Inclusive AI Event Planner introduces a comprehensive, multi-tiered accessibility framework designed to ensure physical, sensory, visual, cognitive, and mobility inclusion across every phase of event planning.

Built on the foundation of the existing Event Planner architecture, the system enforces:
- **Zero Guest PII Exposure**: Complete protection of attendee privacy during AI plan synthesis.
- **Strict Verification Discipline**: No automated assumption or fabrication of venue accommodations—unverified features are explicitly flagged.
- **Deterministic Explainability**: A transparent coverage score (0–100%) and confidence level (`HIGH`, `MEDIUM`, `LOW`) backed by structured factor calculations.
- **Statutory Transparency**: Clear legal disclaimers distinguishing decision-support recommendations from architectural or statutory building code certifications.
- **Assistive Frontend Experience**: WCAG 2.1 AAA high-contrast styling, specialized dyslexia-friendly typography, Web Speech API text-to-speech guidance, and strict keyboard navigation.

```
+------------------------------------------------------------------------------------+
|                                 USER INTERFACE                                     |
|  - Accessibility Hub Dashboard           - Accessibility Settings Modal            |
|  - High-Contrast Display Mode (WCAG AAA)  - Dyslexia-Friendly Reading Typography    |
|  - Text-to-Speech (TTS) Voice Controls    - ARIA Live Regions & Semantic Landmarks  |
+------------------------------------------------------------------------------------+
                                         │
                                         ▼ (REST / JSON + JWT Auth + CSRF)
+------------------------------------------------------------------------------------+
|                              FASTAPI API GATEWAY                                   |
|  - GET    /api/v1/events/{id}/accessibility        (Read profile & venue data)     |
|  - PUT    /api/v1/events/{id}/accessibility/profile(Update requirements profile)   |
|  - PUT    /api/v1/events/{id}/accessibility/venue  (Update venue verifications)    |
|  - POST   /api/v1/events/{id}/accessibility/plan   (Synthesize personalized plan)  |
|  - GET    /api/v1/events/{id}/accessibility/plan   (Retrieve cached plan)          |
+------------------------------------------------------------------------------------+
                                         │
                                         ▼
+------------------------------------------------------------------------------------+
|                            ACCESSIBILITY SERVICE                                   |
|  - Guest Signal Aggregation (Zero PII: strips names, emails, phones, notes)        |
|  - Route Guidance Synthesis (Step-free, elevators, navigation distance)            |
|  - Timeline Barrier Analysis (Durations > 90m, sensory overload, bio breaks)       |
|  - Coverage & Confidence Calculation (Deterministic formula based on checks)       |
|  - Explainability Compiler (Identifies unverified warnings & missing info)         |
+------------------------------------------------------------------------------------+
                                         │
                                         ▼
+------------------------------------------------------------------------------------+
|                         DATABASE LAYER (Alembic 009)                               |
|  - Model: EventAccessibility (Table: event_accessibility)                          |
|  - Relationships: 1:1 with Event (Cascade Delete)                                  |
|  - Dialect Support: SQLite (Development) & PostgreSQL (Production JSONB)          |
+------------------------------------------------------------------------------------+
```

---

## 2. Structured Accessibility Profile

The system models accessibility requirements via the `AccessibilityProfile` entity, supporting 8 core inclusion dimensions:

| Requirement Category | Supported Attributes | Intended Accommodation |
| :--- | :--- | :--- |
| **Mobility Assistance** | `mobility_assistance: bool` | Resting seating, level walking surfaces, accessible parking bays near entrances. |
| **Wheelchair Accessibility** | `wheelchair_accessibility: bool` | Step-free egress, doorway clearances (min 32 in / 81 cm), elevators, ramps. |
| **Visual Impairment** | `visual_impairment: bool` | High-contrast signage, tactile guidance, audio navigation, companion reserved seats. |
| **Hearing Impairment** | `hearing_impairment: bool` | Assistive listening loops, CART captioning, sign language interpreters, clear sightlines. |
| **Sensory Sensitivities** | `sensory_sensitivities: bool` | Designated quiet decompression rooms, subdued lighting, sound volume control. |
| **Cognitive Accessibility** | `cognitive_accessibility: bool` | Visual schedules, structured timelines, plain language communications, low clutter. |
| **Dyslexia-Friendly** | `dyslexia_friendly: bool` | Dyslexia-optimized fonts, increased character/line spacing, voice readout assistance. |
| **Language & Translation** | `language_assistance: bool` | Multilingual physical/digital signage, dedicated on-site translation staff. |

---

## 3. Venue Facilities Verification Checklist

The system tracks 8 standard hospitality and venue facility items, each assigned a strict `VerificationStatus`:
- `VERIFIED`: Confirmed by on-site physical inspection by the organizer or verified venue documentation. Automatically records an ISO 8601 timestamp (`verified_at`).
- `UNVERIFIED`: Acknowledged in planning but pending physical confirmation on-site. Triggers organizer action warnings.
- `NOT_AVAILABLE`: Confirmed as missing or unavailable at the facility. Triggers critical deficiency warnings if requested by attendees.

### Tracked Facility Categories:
1. `accessible_restrooms`: ADA/universal accessible restrooms, grab bars, unisex companion stalls.
2. `wheelchair_entrances`: Level threshold, automated push-pads, doorway clearance >= 32 inches.
3. `ramps_and_elevators`: Certified elevators, ramp gradient compliance (< 1:12 slope).
4. `reserved_seating`: Front-row and companion seating with unobstructed sightlines to stages.
5. `quiet_rooms`: Dedicated low-stimulus spaces with subdued illumination and acoustic baffling.
6. `assistance_desks`: Clearly identified accessibility welcome desks with trained staff.
7. `accessible_parking`: Van-accessible marked bays with barrier-free routes to entry doors.
8. `first_aid`: On-site AED (defibrillator), first aid kits, certified emergency responders.

---

## 4. Privacy & PII Protection Guardrails

To protect sensitive medical, mobility, and personal attendee requirements:
1. **Zero Attendee PII in AI Plan Generation**:
   The backend method `AccessibilityService._extract_aggregated_guest_signals` inspects guest RSVP records and aggregates counts only (e.g. `{"wheelchair": 2, "sensory": 1, "hearing": 1}`).
2. **Strict Sanitization**:
   Attendee names, personal email addresses, phone numbers, and dietary/medical freeform notes are never included in API plan responses or transmitted to external AI providers.
3. **Multi-Tenant Boundary Isolation**:
   All endpoints enforce `verify_event_access(db, event_id, current_user)`, ensuring only verified event owners or administrators can inspect or modify accessibility profiles.

---

## 5. Quantitative Coverage & Reliability Score

The system computes a deterministic coverage score (0.0% to 100.0%) and confidence level:

$$\text{Coverage Score} = \left( \frac{\sum \text{Verified Checks}}{\text{Total Essential Checks}} \right) \times 100\%$$

- **Point Scoring**:
  - `VERIFIED` = 1.0 point
  - `UNVERIFIED` = 0.3 points (partial recognition of planning intent)
  - `NOT_AVAILABLE` = 0.0 points
- **Confidence Rating**:
  - `HIGH`: $\ge 6$ standard facilities verified AND accessible routes verified.
  - `MEDIUM`: $\ge 3$ standard facilities verified.
  - `LOW`: $< 3$ facilities verified.

### Statutory Disclaimer
Every generated plan includes the mandatory disclaimer:
> **NOTICE**: This personalized accessibility plan is an operational decision-support tool created to assist organizers with inclusive logistics. It does not certify legal or architectural building compliance or statutory accessibility codes. On-site verification is required.

---

## 6. Frontend Assistive Technologies

### A. High-Contrast Display Mode (WCAG AAA)
- Toggled via the Accessibility Settings Modal.
- Dynamically injects `.high-contrast` onto `document.documentElement`.
- Enforces pure black-on-white text, high-contrast borders (2px solid black), enhanced element contrast filter, and prominent 3px focus rings (`outline: 3px solid #000000; outline-offset: 3px;`).

### B. Dyslexia-Friendly Reading Mode
- Toggled via the Accessibility Settings Modal.
- Dynamically injects `.dyslexia-mode` onto `document.documentElement`.
- Overrides typography to OpenDyslexic / Comic Sans MS with enhanced letter spacing (`0.05em`), word spacing (`0.12em`), and comfortable line height (`1.75`).

### C. Text-to-Speech (TTS) Voice Engine
- Integrated directly using the browser's native `window.speechSynthesis` and `SpeechSynthesisUtterance`.
- Provides speed adjustment (0.75x to 1.75x) and volume control sliders.
- Dedicated "Listen Aloud" buttons on Executive Summary, Route Guidance, and "Why This Plan?" cards.
- ARIA live region (`role="status"`, `aria-live="polite"`, `.sr-only`) announces user interactions to assistive screen readers.

---

## 7. Automated Testing & Audit Verification

The accessibility implementation is verified across backend and frontend suites:

1. **Backend Tests (`app/tests/test_accessibility.py`)**:
   - `test_accessibility_profile_default_seeding`: Verifies default initialization and schema.
   - `test_update_accessibility_profile_and_score`: Tests score recalculation upon profile edits.
   - `test_update_venue_facilities_verification`: Tests timestamping and confidence promotion.
   - `test_generate_accessibility_plan_routes_and_timeline`: Tests timeline barrier analysis (>90m, sensory events).
   - `test_privacy_safeguard_guest_aggregation`: Asserts zero guest PII appears in plan output.
   - `test_accessibility_multi_tenant_isolation`: Confirms 403 Forbidden for unauthorized users.
   - `test_missing_venue_information_warnings`: Confirms warnings for unverified facilities.
   - *Result: 7 of 7 passed (100%).*

2. **Frontend Tests (`src/test/Accessibility.test.tsx`)**:
   - Store and DOM class synchronization tests (dyslexia font, high contrast).
   - Modal interaction and Escape key keyboard navigation.
   - Dashboard coverage gauge, confidence badges, tab navigation, and statutory disclaimer.
   - Automated WCAG 2.1 AA/AAA compliance audit evaluating landmarks, heading hierarchy, switch roles, and color-independent status indicators.
   - *Result: 11 of 11 passed (100%), overall suite: 78 of 78 tests passed.*

