import { EventType } from './event';

export type CopilotRole = 'user' | 'assistant' | 'system';

export type CopilotActionType =
  | 'ADD_TIMELINE_MILESTONE'
  | 'ADD_BUDGET_EXPENSE'
  | 'ADD_VENDOR_ITEM';

export type CopilotActionStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'DISMISSED'
  | 'FAILED';

export interface CopilotWarning {
  warning_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  message: string;
}

export interface CopilotProposedAction {
  action_id: string;
  action_type: CopilotActionType;
  title: string;
  description?: string | null;
  parameters: Record<string, unknown>;
  status: CopilotActionStatus;
}

export interface CopilotThread {
  id: string;
  event_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface CopilotMessage {
  id: string;
  thread_id: string;
  event_id: string;
  role: CopilotRole;
  content: string;
  suggested_prompts: string[];
  warnings: CopilotWarning[];
  proposed_actions: CopilotProposedAction[];
  source: 'gemini' | 'mock' | 'deterministic_fallback' | string;
  created_at: string;
}

export interface AICopilotChatResponse {
  response: string;
  suggested_prompts: string[];
  suggested_actions?: string[];
  proposed_actions: CopilotProposedAction[];
  warnings: CopilotWarning[];
  source: 'gemini' | 'mock' | 'deterministic_fallback' | string;
}

export interface CopilotActionExecuteResponse {
  action_id: string;
  status: string;
  action_type: string;
  created_resource_id?: string | null;
  details: Record<string, unknown>;
  message: string;
}

export interface CopilotActionDismissResponse {
  action_id: string;
  status: string;
  message: string;
}

// ============================================================================
// Legacy compatibility types for Phase 1-4 AI plans
// ============================================================================

export interface AICategoryAllocation {
  category_name: string;
  percentage: number;
  suggested_amount: number;
  rationale: string;
  recommended_items: string[];
}

export interface AIBudgetPlanResponse {
  event_type: EventType;
  total_budget: number;
  currency: string;
  allocations: AICategoryAllocation[];
  cost_saving_tips: string[];
  disclaimer: string;
}

export interface AIMilestonePlan {
  title: string;
  phase: string;
  recommended_timeline: string;
  key_tasks: string[];
}

export interface AITimelinePlanResponse {
  event_type: EventType;
  milestones: AIMilestonePlan[];
  day_of_schedule_sample: Array<{ time: string; task: string }>;
}

export interface AIVendorChecklistRecommendation {
  category: string;
  recommended_checklist: string[];
  questions_to_ask_vendor: string[];
  booking_urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AIInspirationIdea {
  title: string;
  category: string;
  description: string;
  tags: string[];
}

export interface AICopilotFullPlanResponse {
  summary: string;
  theme_recommendation: string;
  budget_breakdown: AIBudgetPlanResponse;
  timeline_plan: AITimelinePlanResponse;
  vendor_checklists: AIVendorChecklistRecommendation[];
  inspiration_ideas: AIInspirationIdea[];
  source: 'gemini' | 'deterministic_fallback' | 'mock';
}

export interface AICopilotChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedActions?: string[];
  source?: string;
}
