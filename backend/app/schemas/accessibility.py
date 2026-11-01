from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class VerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class AccessibilityProfileInput(BaseModel):
    mobility_assistance: bool = Field(default=False, description="Mobility assistance required")
    wheelchair_accessibility: bool = Field(default=False, description="Wheelchair accessibility required")
    visual_impairment: bool = Field(default=False, description="Visual impairment accommodations needed")
    hearing_impairment: bool = Field(default=False, description="Hearing impairment accommodations needed")
    cognitive_accessibility: bool = Field(default=False, description="Cognitive accessibility features needed")
    dyslexia_friendly: bool = Field(default=False, description="Dyslexia-friendly communications needed")
    sensory_sensitivities: bool = Field(default=False, description="Sensory decompression / low sensory needed")
    language_assistance: bool = Field(default=False, description="Language or translation assistance needed")
    other_requirements: List[str] = Field(default_factory=list, description="Other specific requirements")
    additional_notes: Optional[str] = Field(default="", description="Private notes for event organizers")


class AccessibilityProfileResponse(AccessibilityProfileInput):
    pass


class FacilityItem(BaseModel):
    key: str
    label: str
    status: VerificationStatus
    notes: Optional[str] = None
    verified_at: Optional[datetime] = None


class VenueRoutesInput(BaseModel):
    step_free_access: bool = Field(default=False)
    wheelchair_routes: Optional[str] = Field(default="")
    elevator_details: Optional[str] = Field(default="")
    entrance_instructions: Optional[str] = Field(default="")
    distance_notes: Optional[str] = Field(default="")
    verification_status: VerificationStatus = Field(default=VerificationStatus.UNVERIFIED)


class EmergencySupportInput(BaseModel):
    emergency_contact_phone: Optional[str] = Field(default="")
    venue_assistance_phone: Optional[str] = Field(default="")
    evacuation_procedure: Optional[str] = Field(default="")
    assembly_point: Optional[str] = Field(default="")
    assistance_instructions: Optional[str] = Field(default="")
    verification_status: VerificationStatus = Field(default=VerificationStatus.UNVERIFIED)


class VenueAccessibilityInput(BaseModel):
    facilities: Optional[Dict[str, Dict[str, Any]]] = Field(
        default=None,
        description="Facility status mappings: accessible_restrooms, wheelchair_entrances, ramps_and_elevators, reserved_seating, quiet_rooms, first_aid, assistance_desks, accessible_parking",
    )
    routes: Optional[VenueRoutesInput] = None
    emergency: Optional[EmergencySupportInput] = None


class RouteGuidanceItem(BaseModel):
    title: str
    is_accessible: bool
    is_verified: bool
    description: str
    action_required: Optional[str] = None


class TimelineAccessibilityItem(BaseModel):
    activity_id: Optional[str] = None
    title: str
    time_range: Optional[str] = None
    potential_barrier: str
    accommodation_recommendation: str
    assistance_needed: bool = False


class WhyThisPlanResponse(BaseModel):
    coverage_score: float = Field(ge=0.0, le=100.0, description="Calculated accessibility coverage percentage")
    confidence_level: ConfidenceLevel
    missing_information: List[str] = Field(default_factory=list)
    unverified_warnings: List[str] = Field(default_factory=list)
    compliance_disclaimer: str = Field(
        default="This plan is an operational planning aid and does not constitute formal legal or architectural building compliance certification."
    )


class AccessibilityPlanResponse(BaseModel):
    event_id: str
    event_title: str
    plan_generated_at: datetime
    summary: str
    accessible_routes: List[RouteGuidanceItem]
    accessible_timeline: List[TimelineAccessibilityItem]
    accessible_facilities: List[FacilityItem]
    emergency_sos_support: Dict[str, Any]
    why_this_plan: WhyThisPlanResponse


class EventAccessibilityResponse(BaseModel):
    id: str
    event_id: str
    profile: AccessibilityProfileResponse
    facilities: Dict[str, Dict[str, Any]]
    routes: Dict[str, Any]
    emergency: Dict[str, Any]
    generated_plan: Optional[AccessibilityPlanResponse] = None
    coverage_score: float
    confidence_level: ConfidenceLevel
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

