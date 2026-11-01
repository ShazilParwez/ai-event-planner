export type RSVPStatus =
  | 'INVITED'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'MAYBE'
  | 'WAITING'
  | 'PENDING'
  | 'ATTENDING';

export type GuestCategory =
  | 'Family'
  | 'Friends'
  | 'Colleagues'
  | 'VIP'
  | 'Community'
  | 'Other';

export type InvitationStatus = 'NOT_SENT' | 'SENT';

export interface Guest {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: GuestCategory | string;
  rsvp_status: RSVPStatus;
  invitation_status: InvitationStatus;
  plus_ones: number;
  total_party_count: number;
  dietary_preferences: string | null;
  dietary_restrictions: string | null;
  accessibility_requirements: string | null;
  table_assignment: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuestCreatePayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  category?: string;
  rsvp_status?: RSVPStatus;
  invitation_status?: InvitationStatus;
  plus_ones?: number;
  dietary_preferences?: string | null;
  accessibility_requirements?: string | null;
  table_assignment?: string | null;
  notes?: string | null;
}

export interface GuestUpdatePayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
  category?: string;
  rsvp_status?: RSVPStatus;
  invitation_status?: InvitationStatus;
  plus_ones?: number;
  dietary_preferences?: string | null;
  accessibility_requirements?: string | null;
  table_assignment?: string | null;
  notes?: string | null;
}

export interface GuestAnalytics {
  total_guests: number;
  total_invited: number;
  confirmed_guests: number;
  declined_guests: number;
  pending_responses: number;
  maybe_responses: number;
  expected_attendance: number;
  total_plus_ones: number;
  confirmed_plus_ones: number;
  attendance_rate: number;
  dietary_preference_distribution: Record<string, number>;
  guest_category_distribution: Record<string, number>;
  rsvp_status_distribution: Record<string, number>;
}

export interface GuestListResponse {
  items: Guest[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  analytics?: GuestAnalytics;
}

export interface GuestSummary {
  event_id: string;
  total_invitations: number;
  total_attending_heads: number;
  total_declined_heads: number;
  total_pending_heads: number;
  dietary_breakdown: Record<string, number>;
  guests: Guest[];
}
