import copy
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models.event import Event
from app.models.guest import Guest
from app.models.timeline import TimelineActivity, TimelineMilestone
from app.models.accessibility import (
    EventAccessibility,
    VerificationStatus,
    ConfidenceLevel,
    DEFAULT_PROFILE_TEMPLATE,
    DEFAULT_FACILITIES_TEMPLATE,
    DEFAULT_ROUTES_TEMPLATE,
    DEFAULT_EMERGENCY_TEMPLATE,
)
from app.schemas.accessibility import (
    AccessibilityProfileInput,
    VenueAccessibilityInput,
    FacilityItem,
    RouteGuidanceItem,
    TimelineAccessibilityItem,
    WhyThisPlanResponse,
    AccessibilityPlanResponse,
)
from app.core.logging import logger


class AccessibilityService:
    """
    Manages event accessibility profiles, venue facility verification tracking,
    and deterministic, privacy-preserving accessibility plan generation.
    """

    @classmethod
    def get_or_create(cls, db: Session, event_id: str) -> EventAccessibility:
        """Retrieves existing accessibility record or seeds a fresh default record."""
        record = db.query(EventAccessibility).filter(EventAccessibility.event_id == event_id).first()
        if not record:
            record = EventAccessibility(
                id=str(uuid.uuid4()),
                event_id=event_id,
                profile_data=dict(DEFAULT_PROFILE_TEMPLATE),
                venue_facilities=dict(DEFAULT_FACILITIES_TEMPLATE),
                venue_routes=dict(DEFAULT_ROUTES_TEMPLATE),
                emergency_support=dict(DEFAULT_EMERGENCY_TEMPLATE),
                coverage_score=0.0,
                confidence_level=ConfidenceLevel.LOW.value,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            logger.info(f"Initialized default accessibility profile for event '{event_id}'")
        return record

    @classmethod
    def update_profile(
        cls,
        db: Session,
        event_id: str,
        profile_in: AccessibilityProfileInput,
    ) -> EventAccessibility:
        """Updates the structured accessibility requirements profile."""
        record = cls.get_or_create(db, event_id)
        record.profile_data = profile_in.model_dump()
        flag_modified(record, "profile_data")
        record.updated_at = datetime.now(timezone.utc)

        # Recalculate score based on current venue status
        score, confidence = cls._calculate_coverage_and_confidence(record.profile, record.facilities, record.routes)
        record.coverage_score = score
        record.confidence_level = confidence.value

        db.commit()
        db.refresh(record)
        logger.info(f"Updated accessibility profile for event '{event_id}' (Score: {score}%, Confidence: {confidence.value})")
        return record

    @classmethod
    def update_venue(
        cls,
        db: Session,
        event_id: str,
        venue_in: VenueAccessibilityInput,
    ) -> EventAccessibility:
        """Updates venue facilities verification, routes, and emergency assistance details."""
        record = cls.get_or_create(db, event_id)

        if venue_in.facilities is not None:
            current_facilities = copy.deepcopy(record.facilities)
            for k, v in venue_in.facilities.items():
                if k in current_facilities:
                    current_facilities[k].update(v)
                    if v.get("status") == VerificationStatus.VERIFIED.value:
                        current_facilities[k]["verified_at"] = datetime.now(timezone.utc).isoformat()
            record.venue_facilities = current_facilities
            flag_modified(record, "venue_facilities")

        if venue_in.routes is not None:
            current_routes = copy.deepcopy(record.routes)
            current_routes.update(venue_in.routes.model_dump(exclude_unset=True))
            record.venue_routes = current_routes
            flag_modified(record, "venue_routes")

        if venue_in.emergency is not None:
            current_emergency = copy.deepcopy(record.emergency)
            current_emergency.update(venue_in.emergency.model_dump(exclude_unset=True))
            record.emergency_support = current_emergency
            flag_modified(record, "emergency_support")

        record.updated_at = datetime.now(timezone.utc)

        # Recalculate score and confidence
        score, confidence = cls._calculate_coverage_and_confidence(record.profile, record.facilities, record.routes)
        record.coverage_score = score
        record.confidence_level = confidence.value

        db.commit()
        db.refresh(record)
        logger.info(f"Updated venue accessibility for event '{event_id}' (Score: {score}%, Confidence: {confidence.value})")
        return record

    @classmethod
    def generate_plan(cls, db: Session, event: Event) -> AccessibilityPlanResponse:
        """
        Synthesizes a personalized, privacy-safe accessibility plan based on:
        - Event metadata & timeline schedule
        - Configured accessibility requirements & aggregated guest signals
        - Verified venue facilities, routes, and emergency arrangements
        """
        record = cls.get_or_create(db, event.id)

        # 1. Privacy Safeguard: Aggregate attendee accessibility signals without PII
        guest_signals = cls._extract_aggregated_guest_signals(db, event.id)

        profile = record.profile
        facilities = record.facilities
        routes = record.routes
        emergency = record.emergency

        # 2. Build Accessible Facilities Breakdown
        facility_items: List[FacilityItem] = []
        for key, data in facilities.items():
            status_val = data.get("status", VerificationStatus.UNVERIFIED.value)
            verified_at_dt = None
            if data.get("verified_at"):
                try:
                    verified_at_dt = datetime.fromisoformat(data["verified_at"])
                except Exception:
                    pass

            facility_items.append(
                FacilityItem(
                    key=key,
                    label=data.get("label", key.replace("_", " ").title()),
                    status=VerificationStatus(status_val),
                    notes=data.get("notes"),
                    verified_at=verified_at_dt,
                )
            )

        # 3. Build Accessible Routes Guidance
        route_guidance = cls._synthesize_routes_guidance(routes, profile, guest_signals)

        # 4. Build Accessible Timeline & Barrier Analysis
        timeline_items = cls._analyze_timeline_barriers(db, event.id, profile, guest_signals)

        # 5. Build Emergency & SOS Support
        emergency_summary = cls._synthesize_emergency_support(emergency, profile, guest_signals)

        # 6. Calculate Coverage Score, Confidence & Explainability
        coverage_score, confidence_level = cls._calculate_coverage_and_confidence(profile, facilities, routes)
        missing_info, unverified_warnings = cls._compile_explainability_factors(facilities, routes, emergency, profile)

        why_this_plan = WhyThisPlanResponse(
            coverage_score=coverage_score,
            confidence_level=confidence_level,
            missing_information=missing_info,
            unverified_warnings=unverified_warnings,
            compliance_disclaimer=(
                "NOTICE: This personalized accessibility plan is an operational decision-support tool created "
                "to assist organizers with inclusive logistics. It does not certify legal or architectural building compliance "
                "or statutory accessibility codes. On-site verification is required."
            ),
        )

        # 7. Natural Language Executive Summary
        plan_summary = cls._generate_plan_summary(
            event_title=event.title,
            profile=profile,
            guest_signals=guest_signals,
            coverage_score=coverage_score,
            confidence_level=confidence_level,
            unverified_count=len(unverified_warnings),
        )

        plan = AccessibilityPlanResponse(
            event_id=event.id,
            event_title=event.title,
            plan_generated_at=datetime.now(timezone.utc),
            summary=plan_summary,
            accessible_routes=route_guidance,
            accessible_timeline=timeline_items,
            accessible_facilities=facility_items,
            emergency_sos_support=emergency_summary,
            why_this_plan=why_this_plan,
        )

        # Persist generated plan in database
        record.generated_plan = plan.model_dump(mode="json")
        record.plan_generated_at = plan.plan_generated_at
        record.coverage_score = coverage_score
        record.confidence_level = confidence_level.value
        db.commit()
        db.refresh(record)

        logger.info(f"Generated accessibility plan for event '{event.id}' - Score: {coverage_score}%, Confidence: {confidence_level.value}")
        return plan

    @classmethod
    def _extract_aggregated_guest_signals(cls, db: Session, event_id: str) -> Dict[str, int]:
        """
        PRIVACY SAFEGUARD: Aggregates accessibility counts from guest records
        strictly omitting names, emails, phones, and individual PII.
        """
        guests = db.query(Guest).filter(Guest.event_id == event_id).all()
        signals: Dict[str, int] = {
            "mobility": 0,
            "wheelchair": 0,
            "visual": 0,
            "hearing": 0,
            "sensory": 0,
            "cognitive": 0,
            "other": 0,
        }

        for g in guests:
            req = (g.accessibility_requirements or "").lower()
            if not req:
                continue
            if "wheelchair" in req:
                signals["wheelchair"] += 1
            if "mobility" in req or "walker" in req or "cane" in req or "ramp" in req:
                signals["mobility"] += 1
            if "blind" in req or "visual" in req or "braille" in req or "low vision" in req:
                signals["visual"] += 1
            if "deaf" in req or "hearing" in req or "asl" in req or "sign language" in req or "caption" in req:
                signals["hearing"] += 1
            if "sensory" in req or "autis" in req or "adhd" in req or "quiet" in req or "noise" in req:
                signals["sensory"] += 1
            if "cognitive" in req or "memory" in req or "dyslex" in req:
                signals["cognitive"] += 1

        return signals

    @classmethod
    def _synthesize_routes_guidance(
        cls,
        routes: Dict[str, Any],
        profile: Dict[str, Any],
        guest_signals: Dict[str, int],
    ) -> List[RouteGuidanceItem]:
        items: List[RouteGuidanceItem] = []
        is_verified = routes.get("verification_status") == VerificationStatus.VERIFIED.value
        needs_mobility = (
            profile.get("wheelchair_accessibility")
            or profile.get("mobility_assistance")
            or guest_signals.get("wheelchair", 0) > 0
            or guest_signals.get("mobility", 0) > 0
        )

        # 1. Step-Free Access Guidance
        step_free = bool(routes.get("step_free_access"))
        items.append(
            RouteGuidanceItem(
                title="Step-Free Main Entrance & Pathways",
                is_accessible=step_free,
                is_verified=is_verified,
                description=(
                    "Main entrance has zero step thresholds or certified low-gradient ramps."
                    if step_free
                    else "Main entrance pathways have stairs or unverified step thresholds."
                ),
                action_required=(
                    None
                    if (step_free and is_verified)
                    else "Conduct an on-site physical measurement of thresholds and install temporary ramps if necessary."
                ),
            )
        )

        # 2. Wheelchair & Mobility Corridors
        wheelchair_info = routes.get("wheelchair_routes") or "Corridor navigation details pending organizer audit."
        items.append(
            RouteGuidanceItem(
                title="Interior Wheelchair & Rollator Navigation",
                is_accessible=needs_mobility and is_verified,
                is_verified=is_verified,
                description=wheelchair_info,
                action_required=(
                    None
                    if is_verified
                    else "Verify that interior doorways provide at least 32 inches clear width and turning radiuses (min 60 in)."
                ),
            )
        )

        # 3. Elevators & Multi-Level Vertical Access
        elevator_details = routes.get("elevator_details") or "Elevator status to multi-floor event spaces."
        items.append(
            RouteGuidanceItem(
                title="Elevator and Vertical Transit",
                is_accessible=is_verified,
                is_verified=is_verified,
                description=elevator_details,
                action_required=(
                    None
                    if is_verified
                    else "Confirm elevator keycard access, voice/braille floor announcements, and operational maintenance status."
                ),
            )
        )

        # 4. Transit Distances & Navigation Signs
        distance_notes = routes.get("distance_notes") or "Distance from accessible parking/drop-off to main seating."
        items.append(
            RouteGuidanceItem(
                title="Distance Considerations & Accessible Wayfinding",
                is_accessible=is_verified,
                is_verified=is_verified,
                description=distance_notes,
                action_required="Place high-contrast, large-print directional signage along all primary routes.",
            )
        )

        return items

    @classmethod
    def _analyze_timeline_barriers(
        cls,
        db: Session,
        event_id: str,
        profile: Dict[str, Any],
        guest_signals: Dict[str, int],
    ) -> List[TimelineAccessibilityItem]:
        """Examines timeline activities to detect potential mobility and sensory barriers."""
        activities = (
            db.query(TimelineActivity)
            .filter(TimelineActivity.event_id == event_id)
            .order_by(TimelineActivity.start_time.asc())
            .all()
        )

        items: List[TimelineAccessibilityItem] = []
        needs_sensory = profile.get("sensory_sensitivities") or guest_signals.get("sensory", 0) > 0
        needs_mobility = (
            profile.get("wheelchair_accessibility")
            or profile.get("mobility_assistance")
            or guest_signals.get("wheelchair", 0) > 0
        )
        needs_hearing = profile.get("hearing_impairment") or guest_signals.get("hearing", 0) > 0

        if not activities:
            items.append(
                TimelineAccessibilityItem(
                    title="General Schedule Planning",
                    time_range="All Day",
                    potential_barrier="No detailed timeline activities entered yet.",
                    accommodation_recommendation="Ensure scheduled breaks of 15-20 minutes every 90 minutes of programming.",
                    assistance_needed=False,
                )
            )
            return items

        for act in activities:
            start_str = act.start_time.strftime("%I:%M %p") if act.start_time else "TBD"
            end_str = act.end_time.strftime("%I:%M %p") if act.end_time else "TBD"
            time_range = f"{start_str} - {end_str}"
            title_lower = act.title.lower()

            # Duration calculation
            duration_minutes = 0
            if act.start_time and act.end_time:
                duration_minutes = int((act.end_time - act.start_time).total_seconds() / 60)

            # Check 1: Long session fatigue barrier (>90 mins)
            if duration_minutes > 90:
                items.append(
                    TimelineAccessibilityItem(
                        activity_id=act.id,
                        title=act.title,
                        time_range=time_range,
                        potential_barrier="Continuous programming exceeds 90 minutes without a scheduled physical or cognitive break.",
                        accommodation_recommendation="Introduce a 10-15 minute hydration and sensory decompression intermission.",
                        assistance_needed=needs_mobility or needs_sensory,
                    )
                )

            # Check 2: Audio-heavy or sensory overload activities
            if any(k in title_lower for k in ["dj", "dance", "party", "band", "music", "concert", "firework"]):
                if needs_sensory or needs_hearing:
                    items.append(
                        TimelineAccessibilityItem(
                            activity_id=act.id,
                            title=act.title,
                            time_range=time_range,
                            potential_barrier="High volume acoustics and flashing lighting effects present sensory overload or communication barriers.",
                            accommodation_recommendation="Offer disposable earplugs at assistance desk, maintain an open quiet room, and provide visual cueing.",
                            assistance_needed=True,
                        )
                    )

            # Check 3: Speeches and ceremony presentation activities
            if any(k in title_lower for k in ["speech", "ceremony", "presentation", "keynote", "announcement"]):
                if needs_hearing or profile.get("language_assistance"):
                    items.append(
                        TimelineAccessibilityItem(
                            activity_id=act.id,
                            title=act.title,
                            time_range=time_range,
                            potential_barrier="Verbal presentations without captioning or sign interpretation exclude attendees with hearing impairment.",
                            accommodation_recommendation="Arrange live CART captioning or designated ASL interpreter standing in optimal sightlines.",
                            assistance_needed=True,
                        )
                    )

            # Check 4: Rapid transitions (< 10 minutes)
            # Checked in sequence if activities are tightly packed
            if "transition" in title_lower or "move to" in title_lower or "walk" in title_lower:
                items.append(
                    TimelineAccessibilityItem(
                        activity_id=act.id,
                        title=act.title,
                        time_range=time_range,
                        potential_barrier="Venue room transitions can create bottlenecks for wheelchair users and attendees with limited stamina.",
                        accommodation_recommendation="Authorize early transition release (5 mins ahead) and ensure elevator priority for attendees requiring assistance.",
                        assistance_needed=True,
                    )
                )

        if not items:
            items.append(
                TimelineAccessibilityItem(
                    title="Overall Timeline Schedule",
                    time_range="Full Event",
                    potential_barrier="No high-risk barrier conflicts identified in current schedule.",
                    accommodation_recommendation="Maintain flexible activity start times to accommodate attendee transit and personal assistance needs.",
                    assistance_needed=False,
                )
            )

        return items

    @classmethod
    def _synthesize_emergency_support(
        cls,
        emergency: Dict[str, Any],
        profile: Dict[str, Any],
        guest_signals: Dict[str, int],
    ) -> Dict[str, Any]:
        phone = emergency.get("emergency_contact_phone") or ""
        venue_phone = emergency.get("venue_assistance_phone") or ""
        procedure = emergency.get("evacuation_procedure") or "Standard venue evacuation protocol."
        assembly = emergency.get("assembly_point") or "Designated accessible safe assembly zone."
        instructions = emergency.get("assistance_instructions") or "Assigned staff members to accompany mobility/sensory attendees."
        is_verified = emergency.get("verification_status") == VerificationStatus.VERIFIED.value

        action_required: List[str] = []
        if not phone:
            action_required.append("Add organizer emergency cell contact number.")
        if not venue_phone:
            action_required.append("Confirm venue security or facility manager emergency contact number.")
        if not is_verified:
            action_required.append("Review accessible evacuation routes (e.g. area of refuge, evacuation chairs) with venue coordinator.")

        return {
            "emergency_contact_phone": phone,
            "venue_assistance_phone": venue_phone,
            "evacuation_procedure": procedure,
            "assembly_point": assembly,
            "assistance_instructions": instructions,
            "is_verified": is_verified,
            "action_items": action_required,
        }

    @classmethod
    def _calculate_coverage_and_confidence(
        cls,
        profile: Dict[str, Any],
        facilities: Dict[str, Dict[str, Any]],
        routes: Dict[str, Any],
    ) -> Tuple[float, ConfidenceLevel]:
        """
        Computes a deterministic coverage score (0 - 100%) and recommendation confidence level.
        Does NOT represent legal or physical building code compliance.
        """
        # Map profile requirements to essential facility checks
        checks: List[Tuple[bool, str]] = []

        has_requirements = any([
            profile.get("wheelchair_accessibility"),
            profile.get("mobility_assistance"),
            profile.get("sensory_sensitivities"),
            profile.get("cognitive_accessibility"),
            profile.get("visual_impairment"),
            profile.get("hearing_impairment"),
            profile.get("dyslexia_friendly"),
            profile.get("language_assistance"),
        ])

        if has_requirements:
            if profile.get("wheelchair_accessibility") or profile.get("mobility_assistance"):
                checks.append((True, "wheelchair_entrances"))
                checks.append((True, "ramps_and_elevators"))
                checks.append((True, "accessible_restrooms"))
                checks.append((True, "accessible_parking"))

            if profile.get("sensory_sensitivities") or profile.get("cognitive_accessibility"):
                checks.append((True, "quiet_rooms"))

            if profile.get("visual_impairment") or profile.get("hearing_impairment"):
                checks.append((True, "reserved_seating"))
                checks.append((True, "assistance_desks"))

            # Base universal hospitality check
            checks.append((True, "first_aid"))
            checks.append((True, "assistance_desks"))
        else:
            # Baseline venue audit across all standard facilities
            for fac_key in DEFAULT_FACILITIES_TEMPLATE.keys():
                checks.append((True, fac_key))

        verified_points = 0.0
        total_points = float(len(checks))

        for _, facility_key in checks:
            fac = facilities.get(facility_key, {})
            status = fac.get("status")
            if status == VerificationStatus.VERIFIED.value:
                verified_points += 1.0
            elif status == VerificationStatus.UNVERIFIED.value:
                verified_points += 0.3  # Partial credit for being acknowledged but unverified
            elif status == VerificationStatus.NOT_AVAILABLE.value:
                verified_points += 0.0

        coverage_score = round((verified_points / total_points) * 100.0, 1)

        # Confidence is determined by how many facilities are actually VERIFIED
        verified_count = sum(
            1 for f in facilities.values() if f.get("status") == VerificationStatus.VERIFIED.value
        )
        total_facilities = len(facilities)

        routes_verified = routes.get("verification_status") == VerificationStatus.VERIFIED.value

        if verified_count >= 6 and routes_verified:
            confidence = ConfidenceLevel.HIGH
        elif verified_count >= 3:
            confidence = ConfidenceLevel.MEDIUM
        else:
            confidence = ConfidenceLevel.LOW

        return coverage_score, confidence

    @classmethod
    def _compile_explainability_factors(
        cls,
        facilities: Dict[str, Dict[str, Any]],
        routes: Dict[str, Any],
        emergency: Dict[str, Any],
        profile: Dict[str, Any],
    ) -> Tuple[List[str], List[str]]:
        missing_info: List[str] = []
        unverified_warnings: List[str] = []

        for key, data in facilities.items():
            status = data.get("status")
            label = data.get("label", key)
            if status == VerificationStatus.UNVERIFIED.value:
                missing_info.append(f"{label}: Verification pending.")
                unverified_warnings.append(f"Venue facility '{label}' has not been confirmed on-site.")
            elif status == VerificationStatus.NOT_AVAILABLE.value:
                # Check if this facility is needed by profile
                if (
                    ("wheelchair" in key or "ramp" in key)
                    and (profile.get("wheelchair_accessibility") or profile.get("mobility_assistance"))
                ):
                    unverified_warnings.append(f"CRITICAL GAP: '{label}' is marked NOT AVAILABLE while mobility accommodations are required.")
                elif "quiet" in key and profile.get("sensory_sensitivities"):
                    unverified_warnings.append(f"ATTENTION: '{label}' is NOT AVAILABLE while sensory sensitivities are configured.")

        if routes.get("verification_status") != VerificationStatus.VERIFIED.value:
            missing_info.append("Accessible Routes: Step-free access and elevator transit unverified.")
            unverified_warnings.append("Accessible pathways between parking and event hall require physical inspection.")

        if emergency.get("verification_status") != VerificationStatus.VERIFIED.value:
            missing_info.append("Emergency Egress: Accessible evacuation protocol not verified with venue.")

        if not emergency.get("emergency_contact_phone"):
            missing_info.append("Emergency Contact: Dedicated organizer phone number is missing.")

        return missing_info, unverified_warnings

    @classmethod
    def _generate_plan_summary(
        cls,
        event_title: str,
        profile: Dict[str, Any],
        guest_signals: Dict[str, int],
        coverage_score: float,
        confidence_level: ConfidenceLevel,
        unverified_count: int,
    ) -> str:
        """Constructs an explainable, empathetic summary of the accessibility posture."""
        requirements_list: List[str] = []
        if profile.get("wheelchair_accessibility"):
            requirements_list.append("Wheelchair Accessibility")
        if profile.get("mobility_assistance"):
            requirements_list.append("Mobility Support")
        if profile.get("visual_impairment"):
            requirements_list.append("Visual Accommodations")
        if profile.get("hearing_impairment"):
            requirements_list.append("Hearing Accommodations")
        if profile.get("cognitive_accessibility"):
            requirements_list.append("Cognitive Accessibility")
        if profile.get("dyslexia_friendly"):
            requirements_list.append("Dyslexia-Friendly Communication")
        if profile.get("sensory_sensitivities"):
            requirements_list.append("Sensory Sensitivity Accommodations")
        if profile.get("language_assistance"):
            requirements_list.append("Language/Translation Support")

        req_summary = ", ".join(requirements_list) if requirements_list else "Standard Universal Accessibility"

        verification_note = (
            "All major facilities have been verified with high confidence."
            if confidence_level == ConfidenceLevel.HIGH
            else f"There are {unverified_count} venue items requiring on-site verification before the event."
        )

        return (
            f"Personalized accessibility plan prepared for '{event_title}'. "
            f"Targeting: {req_summary}. "
            f"Current estimated accessibility readiness is {coverage_score}% ({confidence_level.value} confidence). "
            f"{verification_note} "
            f"Review the timeline barrier analysis and venue verification checklist below to ensure an inclusive experience for all attendees."
        )
