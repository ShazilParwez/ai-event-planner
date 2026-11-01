export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'NOT_AVAILABLE';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AccessibilityProfile {
  mobility_assistance: boolean;
  wheelchair_accessibility: boolean;
  visual_impairment: boolean;
  hearing_impairment: boolean;
  cognitive_accessibility: boolean;
  dyslexia_friendly: boolean;
  sensory_sensitivities: boolean;
  language_assistance: boolean;
  other_requirements: string[];
  additional_notes: string;
}

export interface FacilityItem {
  key: string;
  label: string;
  status: VerificationStatus;
  notes?: string | null;
  verified_at?: string | null;
}

export interface RouteGuidanceItem {
  route_type: string;
  description: string;
  step_free: boolean;
  elevator_accessible: boolean;
  distance_notes: string;
  verification_status: VerificationStatus;
  warning_alert?: string | null;
}

export interface TimelineAccessibilityItem {
  activity_id: string;
  title: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  potential_barrier?: string | null;
  sensory_break_recommended: boolean;
  mobility_notes?: string | null;
  suggested_accommodation?: string | null;
}

export interface WhyThisPlanResponse {
  coverage_score: number;
  confidence_level: ConfidenceLevel;
  missing_information: string[];
  unverified_warnings: string[];
  compliance_disclaimer: string;
}

export interface EmergencySupportDetails {
  emergency_contact_phone?: string | null;
  venue_assistance_phone?: string | null;
  evacuation_procedure?: string | null;
  assembly_point?: string | null;
  audible_instructions?: string | null;
  verification_status?: VerificationStatus;
}

export interface AccessibilityPlanResponse {
  event_id: string;
  event_title: string;
  plan_generated_at: string;
  summary: string;
  accessible_routes: RouteGuidanceItem[];
  accessible_timeline: TimelineAccessibilityItem[];
  accessible_facilities: FacilityItem[];
  emergency_sos_support: EmergencySupportDetails;
  why_this_plan: WhyThisPlanResponse;
}

export interface EventAccessibilityData {
  event_id: string;
  profile: AccessibilityProfile;
  facilities: Record<string, FacilityItem>;
  routes: {
    step_free_access: boolean;
    wheelchair_routes?: string | null;
    elevator_details?: string | null;
    entrance_guidance?: string | null;
    navigation_distance_meters?: number | null;
    verification_status: VerificationStatus;
  };
  emergency: EmergencySupportDetails;
  coverage_score: number;
  confidence_level: ConfidenceLevel;
  generated_plan?: AccessibilityPlanResponse | null;
  plan_generated_at?: string | null;
  updated_at: string;
}

export interface AccessibilityProfileInput {
  mobility_assistance?: boolean;
  wheelchair_accessibility?: boolean;
  visual_impairment?: boolean;
  hearing_impairment?: boolean;
  cognitive_accessibility?: boolean;
  dyslexia_friendly?: boolean;
  sensory_sensitivities?: boolean;
  language_assistance?: boolean;
  other_requirements?: string[];
  additional_notes?: string;
}

export interface VenueAccessibilityInput {
  facilities?: Record<string, { status: VerificationStatus; notes?: string }>;
  routes?: {
    step_free_access?: boolean;
    wheelchair_routes?: string;
    elevator_details?: string;
    entrance_guidance?: string;
    navigation_distance_meters?: number;
    verification_status?: VerificationStatus;
  };
  emergency?: {
    emergency_contact_phone?: string;
    venue_assistance_phone?: string;
    evacuation_procedure?: string;
    assembly_point?: string;
    audible_instructions?: string;
    verification_status?: VerificationStatus;
  };
}

