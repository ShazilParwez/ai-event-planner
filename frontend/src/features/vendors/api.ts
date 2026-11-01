import { apiClient } from '@/lib/api-client';
import {
  VendorSummary,
  VendorCategory,
  VendorItem,
  VendorItemCreateInput,
  VendorItemUpdateInput,
} from '@/types/vendor';

export const vendorsApi = {
  getVendorSummary: async (
    eventId: string,
    params?: { category?: string | undefined; status?: string | undefined }
  ): Promise<VendorSummary> => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiClient.get<VendorSummary>(`/events/${eventId}/vendors${qs ? `?${qs}` : ''}`);
  },

  getCategories: async (): Promise<VendorCategory[]> => {
    return apiClient.get<VendorCategory[]>('/vendors/categories');
  },

  seedCategories: async (): Promise<VendorCategory[]> => {
    return apiClient.post<VendorCategory[]>('/vendors/categories/seed', {});
  },

  createVendor: async (
    eventId: string,
    data: VendorItemCreateInput
  ): Promise<VendorItem> => {
    return apiClient.post<VendorItem>(`/events/${eventId}/vendors`, data);
  },

  updateVendor: async (
    eventId: string,
    vendorId: string,
    data: VendorItemUpdateInput
  ): Promise<VendorItem> => {
    return apiClient.put<VendorItem>(`/events/${eventId}/vendors/${vendorId}`, data);
  },

  deleteVendor: async (eventId: string, vendorId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/vendors/${vendorId}`);
  },
};

