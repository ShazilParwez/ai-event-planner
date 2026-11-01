import copy
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.models.base import Base, UUIDMixin, TimestampMixin


class VerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


DEFAULT_FACILITIES_TEMPLATE: Dict[str, Dict[str, Any]] = {
    "accessible_restrooms": {
        "label": "Accessible Restrooms",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Requires on-site confirmation of stall width, grab bars, and step-free access.",
        "verified_at": None,
    },
    "wheelchair_entrances": {
        "label": "Wheelchair-Accessible Entrances",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Verify automatic doors, threshold ramp, and doorway clearance (min 32 in).",
        "verified_at": None,
    },
    "ramps_and_elevators": {
        "label": "Ramps and Elevators",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Verify elevator operational status and ramp gradient to all event floors.",
        "verified_at": None,
    },
    "reserved_seating": {
        "label": "Reserved Accessible Seating",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Designate companion seating and unobstructed sightlines.",
        "verified_at": None,
    },
    "quiet_rooms": {
        "label": "Quiet / Sensory-Friendly Rooms",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Confirm quiet room availability for neurodiverse attendees and sensory decompression.",
        "verified_at": None,
    },
    "first_aid": {
        "label": "First-Aid Facilities",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Confirm first aid kit location, trained personnel, and AED availability.",
        "verified_at": None,
    },
    "assistance_desks": {
        "label": "Accessibility Assistance / Help Desks",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Designate clearly marked help desk with staff trained in accessibility accommodations.",
        "verified_at": None,
    },
    "accessible_parking": {
        "label": "Accessible Parking & Drop-Off Zones",
        "status": VerificationStatus.UNVERIFIED.value,
        "notes": "Confirm designated accessible spaces and step-free pathway from drop-off to entrance.",
        "verified_at": None,
    },
}

DEFAULT_ROUTES_TEMPLATE: Dict[str, Any] = {
    "step_free_access": False,
    "wheelchair_routes": "Requires inspection of thresholds, pathway surfaces, and corridor widths.",
    "elevator_details": "Requires verification of floor call buttons and elevator dimension clearance.",
    "entrance_instructions": "Main entrance access details pending organizer verification.",
    "distance_notes": "Estimate walking and rolling distances between parking, venue entrance, and seating.",
    "verification_status": VerificationStatus.UNVERIFIED.value,
}

DEFAULT_EMERGENCY_TEMPLATE: Dict[str, Any] = {
    "emergency_contact_phone": "",
    "venue_assistance_phone": "",
    "evacuation_procedure": "Confirm emergency egress protocols with venue coordinator for attendees with mobility or sensory limitations.",
    "assembly_point": "Designated accessible outdoor assembly zone to be confirmed with venue management.",
    "assistance_instructions": "Staff designated to assist attendees requiring physical evacuation or sensory support.",
    "verification_status": VerificationStatus.UNVERIFIED.value,
}

DEFAULT_PROFILE_TEMPLATE: Dict[str, Any] = {
    "mobility_assistance": False,
    "wheelchair_accessibility": False,
    "visual_impairment": False,
    "hearing_impairment": False,
    "cognitive_accessibility": False,
    "dyslexia_friendly": False,
    "sensory_sensitivities": False,
    "language_assistance": False,
    "other_requirements": [],
    "additional_notes": "",
}


class EventAccessibility(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "event_accessibility"

    event_id = Column(
        String(36),
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # 1. Structured Accessibility Profile
    profile_data = Column(JSON, nullable=False, default=dict)

    # 2. Venue Facilities Verification
    venue_facilities = Column(JSON, nullable=False, default=dict)

    # 3. Accessible Route Information
    venue_routes = Column(JSON, nullable=False, default=dict)

    # 4. Emergency and SOS Support
    emergency_support = Column(JSON, nullable=False, default=dict)

    # 5. Generated Accessibility Plan
    generated_plan = Column(JSON, nullable=True)
    plan_generated_at = Column(DateTime(timezone=True), nullable=True)

    # 6. Quantitative Coverage & Reliability
    coverage_score = Column(Float, nullable=False, default=0.0)
    confidence_level = Column(String(20), nullable=False, default=ConfidenceLevel.LOW.value)

    # Relationship to parent event
    event = relationship("Event", back_populates="accessibility_profile")

    @property
    def profile(self) -> Dict[str, Any]:
        data: Dict[str, Any] = self.profile_data or {}
        merged: Dict[str, Any] = copy.deepcopy(DEFAULT_PROFILE_TEMPLATE)
        merged.update(data)
        return merged

    @property
    def facilities(self) -> Dict[str, Dict[str, Any]]:
        raw: Dict[str, Any] = self.venue_facilities or {}
        merged: Dict[str, Dict[str, Any]] = copy.deepcopy(DEFAULT_FACILITIES_TEMPLATE)
        for k, v in raw.items():
            if k in merged and isinstance(v, dict):
                merged[k].update(v)
            else:
                merged[k] = copy.deepcopy(v) if isinstance(v, dict) else v
        return merged

    @property
    def routes(self) -> Dict[str, Any]:
        routes: Dict[str, Any] = self.venue_routes or {}
        merged: Dict[str, Any] = copy.deepcopy(DEFAULT_ROUTES_TEMPLATE)
        merged.update(routes)
        return merged

    @property
    def emergency(self) -> Dict[str, Any]:
        emergency: Dict[str, Any] = self.emergency_support or {}
        merged: Dict[str, Any] = copy.deepcopy(DEFAULT_EMERGENCY_TEMPLATE)
        merged.update(emergency)
        return merged
