export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DELAYED';
export type MilestonePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TimelineActivity {
  id: string;
  event_id: string;
  milestone_id: string | null;
  title: string;
  start_time: string;
  end_time: string | null;
  responsible_party: string | null;
  location: string | null;
  status: string;
  order_index: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineMilestone {
  id: string;
  event_id: string;
  title: string;
  phase: string;
  target_date: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  priority: MilestonePriority;
  description: string | null;
  order_index: number;
  is_ai_suggested: boolean;
  is_completed: boolean;
  is_overdue: boolean;
  activities: TimelineActivity[];
  created_at: string;
  updated_at: string;
}

export interface TimelineOverview {
  event_id: string;
  total_milestones: number;
  completed_milestones: number;
  pending_milestones: number;
  overdue_milestones: number;
  completion_percentage: number;
  milestones: TimelineMilestone[];
  activities: TimelineActivity[];
}

export interface MilestoneCreateInput {
  title: string;
  phase?: string | undefined;
  target_date?: string | null | undefined;
  due_date?: string | null | undefined;
  status?: MilestoneStatus | undefined;
  priority?: MilestonePriority | undefined;
  description?: string | null | undefined;
  order_index?: number | undefined;
}

export interface MilestoneUpdateInput {
  title?: string | undefined;
  phase?: string | undefined;
  target_date?: string | null | undefined;
  due_date?: string | null | undefined;
  status?: MilestoneStatus | undefined;
  priority?: MilestonePriority | undefined;
  description?: string | null | undefined;
  order_index?: number | undefined;
}

export interface ActivityCreateInput {
  title: string;
  start_time: string;
  end_time?: string | null | undefined;
  responsible_party?: string | null | undefined;
  location?: string | null | undefined;
  status?: string | undefined;
  order_index?: number | undefined;
  description?: string | null | undefined;
  milestone_id?: string | null | undefined;
}

export interface ActivityUpdateInput {
  title?: string | undefined;
  start_time?: string | undefined;
  end_time?: string | null | undefined;
  responsible_party?: string | null | undefined;
  location?: string | null | undefined;
  status?: string | undefined;
  order_index?: number | undefined;
  description?: string | null | undefined;
  milestone_id?: string | null | undefined;
}
