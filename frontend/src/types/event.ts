export type EventType = 'WEDDING' | 'BIRTHDAY' | 'COMMUNITY' | 'OTHER';

export type EventStatus = 'PLANNING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Event {
  id: string;
  title: string;
  name?: string | undefined;
  event_type: EventType;
  description?: string | null | undefined;
  location?: string | null | undefined;
  start_date?: string | null | undefined;
  end_date?: string | null | undefined;
  expected_guest_count: number;
  target_budget: number;
  total_budget?: number | undefined;
  currency: string;
  status: EventStatus;
  event_date?: string | null | undefined;
  theme?: string | null | undefined;
  notes?: string | null | undefined;
  created_at: string;
  updated_at: string;
}

export interface EventCreateInput {
  title: string;
  name?: string | undefined;
  event_type: EventType;
  description?: string | undefined;
  location?: string | undefined;
  start_date?: string | undefined;
  end_date?: string | undefined;
  expected_guest_count?: number | undefined;
  target_budget: number;
  total_budget?: number | undefined;
  currency?: string | undefined;
  theme?: string | undefined;
  notes?: string | undefined;
  status?: EventStatus | undefined;
}

export interface EventUpdateInput extends Partial<EventCreateInput> {
  status?: EventStatus | undefined;
}

export interface EventPagination {
  items: Event[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
