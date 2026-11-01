import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from './api';
import {
  BudgetCategoryCreateInput,
  BudgetCategoryUpdateInput,
  BudgetItemCreateInput,
  BudgetItemUpdateInput,
} from '@/types/budget';

export const BUDGET_QUERY_KEYS = {
  all: ['budget'] as const,
  overview: (eventId: string) => ['budget', 'overview', eventId] as const,
  categories: (eventId: string) => ['budget', 'categories', eventId] as const,
  items: (eventId: string, categoryId?: string) => ['budget', 'items', eventId, categoryId] as const,
};

export const useBudgetOverviewQuery = (eventId: string | null) => {
  return useQuery({
    queryKey: BUDGET_QUERY_KEYS.overview(eventId || ''),
    queryFn: () => budgetApi.getBudgetOverview(eventId!),
    enabled: Boolean(eventId),
  });
};

export const useCreateCategoryMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BudgetCategoryCreateInput) => budgetApi.createCategory(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.categories(eventId) });
    },
  });
};

export const useUpdateCategoryMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: BudgetCategoryUpdateInput }) =>
      budgetApi.updateCategory(eventId, categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.categories(eventId) });
    },
  });
};

export const useDeleteCategoryMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, force }: { categoryId: string; force?: boolean }) =>
      budgetApi.deleteCategory(eventId, categoryId, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.categories(eventId) });
    },
  });
};

export const useSeedCategoriesMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => budgetApi.seedCategories(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.categories(eventId) });
    },
  });
};

export const useCreateBudgetItemMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BudgetItemCreateInput) => budgetApi.createItem(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.items(eventId) });
    },
  });
};

export const useUpdateBudgetItemMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: BudgetItemUpdateInput }) =>
      budgetApi.updateItem(eventId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.items(eventId) });
    },
  });
};

export const useDeleteBudgetItemMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => budgetApi.deleteItem(eventId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.overview(eventId) });
      queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEYS.items(eventId) });
    },
  });
};

