export type VendorStatus =
  | 'DISCOVERING'
  | 'CONTACTED'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'BOOKED'
  | 'CANCELLED'
  | 'TODO'
  | 'RESEARCHING'
  | 'HIRED'
  | 'REJECTED';

export interface VendorCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface VendorItem {
  id: string;
  event_id: string;
  category: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  website: string | null;
  status: VendorStatus;
  estimated_quote: number | null;
  final_agreed_price: number | null;
  advance_paid: number;
  quoted_amount: number;
  agreed_cost: number;
  remaining_payment: number;
  contract_signed: boolean;
  notes: string | null;
  is_ai_suggested_checklist: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorSummary {
  event_id: string;
  currency: string;
  total_vendors: number;
  booked_vendors: number;
  hired_vendors: number;
  pending_vendors: number;
  total_quoted_amount: number;
  total_agreed_cost: number;
  total_advance_paid: number;
  total_remaining_payment: number;
  total_contracted_spend: number;
  items: VendorItem[];
}

export interface VendorItemCreateInput {
  category: string;
  name: string;
  contact_name?: string | null | undefined;
  contact_email?: string | null | undefined;
  contact_phone?: string | null | undefined;
  location?: string | null | undefined;
  website?: string | null | undefined;
  status?: VendorStatus | undefined;
  estimated_quote?: number | null | undefined;
  final_agreed_price?: number | null | undefined;
  advance_paid?: number | undefined;
  contract_signed?: boolean | undefined;
  notes?: string | null | undefined;
  is_ai_suggested_checklist?: boolean | undefined;
}

export interface VendorItemUpdateInput {
  category?: string | undefined;
  name?: string | undefined;
  contact_name?: string | null | undefined;
  contact_email?: string | null | undefined;
  contact_phone?: string | null | undefined;
  location?: string | null | undefined;
  website?: string | null | undefined;
  status?: VendorStatus | undefined;
  estimated_quote?: number | null | undefined;
  final_agreed_price?: number | null | undefined;
  advance_paid?: number | undefined;
  contract_signed?: boolean | undefined;
  notes?: string | null | undefined;
}
