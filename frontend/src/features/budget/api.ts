import { apiClient } from '@/lib/api-client';
import {
  BudgetOverview,
  BudgetCategory,
  BudgetCategoryCreateInput,
  BudgetCategoryUpdateInput,
  BudgetItem,
  BudgetItemCreateInput,
  BudgetItemUpdateInput,
  SeedCategoriesResult,
} from '@/types/budget';

export const budgetApi = {
  getBudgetOverview: async (eventId: string): Promise<BudgetOverview> => {
    return apiClient.get<BudgetOverview>(`/events/${eventId}/budget`);
  },

  listCategories: async (eventId: string): Promise<BudgetCategory[]> => {
    return apiClient.get<BudgetCategory[]>(`/events/${eventId}/budget/categories`);
  },

  createCategory: async (
    eventId: string,
    data: BudgetCategoryCreateInput
  ): Promise<BudgetCategory> => {
    return apiClient.post<BudgetCategory>(`/events/${eventId}/budget/categories`, data);
  },

  updateCategory: async (
    eventId: string,
    categoryId: string,
    data: BudgetCategoryUpdateInput
  ): Promise<BudgetCategory> => {
    return apiClient.put<BudgetCategory>(
      `/events/${eventId}/budget/categories/${categoryId}`,
      data
    );
  },

  deleteCategory: async (
    eventId: string,
    categoryId: string,
    force: boolean = false
  ): Promise<void> => {
    return apiClient.delete<void>(
      `/events/${eventId}/budget/categories/${categoryId}${force ? '?force=true' : ''}`
    );
  },

  seedCategories: async (eventId: string): Promise<SeedCategoriesResult> => {
    return apiClient.post<SeedCategoriesResult>(`/events/${eventId}/budget/categories/seed`);
  },

  listItems: async (eventId: string, categoryId?: string): Promise<BudgetItem[]> => {
    const qs = categoryId ? `?category_id=${categoryId}` : '';
    return apiClient.get<BudgetItem[]>(`/events/${eventId}/budget/items${qs}`);
  },

  createItem: async (eventId: string, data: BudgetItemCreateInput): Promise<BudgetItem> => {
    return apiClient.post<BudgetItem>(`/events/${eventId}/budget/items`, data);
  },

  updateItem: async (
    eventId: string,
    itemId: string,
    data: BudgetItemUpdateInput
  ): Promise<BudgetItem> => {
    return apiClient.put<BudgetItem>(`/events/${eventId}/budget/items/${itemId}`, data);
  },

  deleteItem: async (eventId: string, itemId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/budget/items/${itemId}`);
  },
};

