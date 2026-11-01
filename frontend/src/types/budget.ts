export type BudgetItemStatus = 'ESTIMATED' | 'PENDING' | 'PAID';

export interface BudgetItem {
  id: string;
  category_id: string;
  event_id: string;
  title: string;
  estimated_cost: number;
  actual_cost: number;
  paid_amount: number;
  status: BudgetItemStatus;
  is_ai_suggested: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItemCreateInput {
  category_id: string;
  title: string;
  estimated_cost?: number | undefined;
  actual_cost?: number | undefined;
  paid_amount?: number | undefined;
  status?: BudgetItemStatus | undefined;
  notes?: string | undefined;
  is_ai_suggested?: boolean | undefined;
}

export interface BudgetItemUpdateInput {
  category_id?: string | undefined;
  title?: string | undefined;
  estimated_cost?: number | undefined;
  actual_cost?: number | undefined;
  paid_amount?: number | undefined;
  status?: BudgetItemStatus | undefined;
  notes?: string | undefined;
}

export interface BudgetCategory {
  id: string;
  event_id: string;
  name: string;
  allocated_amount: number;
  percentage_target: number;
  items: BudgetItem[];
  total_estimated: number;
  total_actual: number;
  total_paid: number;
  variance?: number | undefined;
  utilization_percentage?: number | undefined;
  is_over_allocated?: boolean | undefined;
}

export interface BudgetCategoryCreateInput {
  name: string;
  allocated_amount?: number | undefined;
  percentage_target?: number | undefined;
}

export interface BudgetCategoryUpdateInput {
  name?: string | undefined;
  allocated_amount?: number | undefined;
  percentage_target?: number | undefined;
}

export interface BudgetOverview {
  event_id: string;
  target_budget: number;
  total_allocated: number;
  total_estimated: number;
  total_actual: number;
  total_paid: number;
  remaining_budget: number;
  variance: number;
  is_over_budget: boolean;
  currency: string;
  categories: BudgetCategory[];
}

export interface SeedCategoriesResult {
  message: string;
  created_count: number;
  categories: BudgetCategory[];
}
