import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorsApi } from './api';
import { VendorItemCreateInput, VendorItemUpdateInput } from '@/types/vendor';

export const VENDOR_QUERY_KEYS = {
  all: ['vendors'] as const,
  categories: ['vendors', 'categories'] as const,
  summary: (eventId: string, filters?: Record<string, unknown>) =>
    ['vendors', 'summary', eventId, filters] as const,
};

export const useVendorCategoriesQuery = () => {
  return useQuery({
    queryKey: VENDOR_QUERY_KEYS.categories,
    queryFn: () => vendorsApi.getCategories(),
  });
};

export const useSeedVendorCategoriesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => vendorsApi.seedCategories(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDOR_QUERY_KEYS.categories });
    },
  });
};

export const useVendorSummaryQuery = (
  eventId: string | null,
  filters?: { category?: string | undefined; status?: string | undefined }
) => {
  return useQuery({
    queryKey: VENDOR_QUERY_KEYS.summary(eventId || '', filters),
    queryFn: () => vendorsApi.getVendorSummary(eventId!, filters),
    enabled: Boolean(eventId),
  });
};

export const useCreateVendorMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: VendorItemCreateInput) => vendorsApi.createVendor(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDOR_QUERY_KEYS.all });
    },
  });
};

export const useUpdateVendorMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vendorId, data }: { vendorId: string; data: VendorItemUpdateInput }) =>
      vendorsApi.updateVendor(eventId, vendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDOR_QUERY_KEYS.all });
    },
  });
};

export const useDeleteVendorMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vendorId: string) => vendorsApi.deleteVendor(eventId, vendorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VENDOR_QUERY_KEYS.all });
    },
  });
};

