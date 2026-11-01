export type InspirationCategory =
  | 'Event Themes'
  | 'Decorations'
  | 'Color Palettes'
  | 'Catering and Menus'
  | 'Entertainment'
  | 'Photography Concepts'
  | 'Invitations'
  | 'Activities'
  | 'Other';

export type InspirationSource = 'USER' | 'AI_GENERATED';

export interface InspirationCard {
  id: string;
  event_id: string;
  title: string;
  category: string;
  description: string;
  tags?: string | null;
  color_palette?: string[] | null;
  suggested_budget_range?: string | null;
  notes?: string | null;
  is_saved: boolean;
  is_ai_generated: boolean;
  source_type: InspirationSource | string;
  created_at: string;
  updated_at?: string | null;
}

export interface InspirationCardCreatePayload {
  title: string;
  category: string;
  description: string;
  tags?: string | null | undefined;
  color_palette?: string[] | null | undefined;
  suggested_budget_range?: string | null | undefined;
  notes?: string | null | undefined;
  is_saved?: boolean | undefined;
  is_ai_generated?: boolean | undefined;
  source_type?: string | undefined;
}

export interface InspirationCardUpdatePayload {
  title?: string | undefined;
  category?: string | undefined;
  description?: string | undefined;
  tags?: string | null | undefined;
  color_palette?: string[] | null | undefined;
  suggested_budget_range?: string | null | undefined;
  notes?: string | null | undefined;
  is_saved?: boolean | undefined;
  source_type?: string | undefined;
}

export interface GeneratedIdea {
  title: string;
  category: string;
  description: string;
  tags: string[];
  color_palette: string[];
  suggested_budget_range?: string | null | undefined;
  source_type: string;
}

export interface InspirationGenerateRequestPayload {
  event_id: string;
  category?: string | null | undefined;
  custom_prompt?: string | null | undefined;
  num_ideas?: number | undefined;
}

export interface InspirationGenerateResponse {
  ideas: GeneratedIdea[];
  disclaimer: string;
  source: string;
}
