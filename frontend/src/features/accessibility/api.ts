import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  EventAccessibilityData,
  AccessibilityPlanResponse,
  AccessibilityProfileInput,
  VenueAccessibilityInput,
} from '@/types/accessibility';
import { useNotificationStore } from '@/stores/useNotificationStore';

export const ACCESSIBILITY_QUERY_KEYS = {
  all: ['accessibility'] as const,
  event: (eventId: string) => ['accessibility', eventId] as const,
  plan: (eventId: string) => ['accessibility', eventId, 'plan'] as const,
};

export const accessibilityApi = {
  getAccessibility: async (eventId: string): Promise<EventAccessibilityData> => {
    return apiClient.get<EventAccessibilityData>(`/events/${eventId}/accessibility`);
  },

  updateProfile: async (
    eventId: string,
    data: AccessibilityProfileInput
  ): Promise<EventAccessibilityData> => {
    return apiClient.put<EventAccessibilityData>(`/events/${eventId}/accessibility/profile`, data);
  },

  updateVenue: async (
    eventId: string,
    data: VenueAccessibilityInput
  ): Promise<EventAccessibilityData> => {
    return apiClient.put<EventAccessibilityData>(`/events/${eventId}/accessibility/venue`, data);
  },

  generatePlan: async (eventId: string): Promise<AccessibilityPlanResponse> => {
    return apiClient.post<AccessibilityPlanResponse>(`/events/${eventId}/accessibility/plan`);
  },

  getPlan: async (eventId: string): Promise<AccessibilityPlanResponse> => {
    return apiClient.get<AccessibilityPlanResponse>(`/events/${eventId}/accessibility/plan`);
  },
};

export const useAccessibilityQuery = (eventId: string | null) => {
  return useQuery({
    queryKey: ACCESSIBILITY_QUERY_KEYS.event(eventId || ''),
    queryFn: () => accessibilityApi.getAccessibility(eventId!),
    enabled: Boolean(eventId),
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useUpdateAccessibilityProfileMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (data: AccessibilityProfileInput) =>
      accessibilityApi.updateProfile(eventId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(ACCESSIBILITY_QUERY_KEYS.event(eventId), data);
      queryClient.invalidateQueries({ queryKey: ACCESSIBILITY_QUERY_KEYS.event(eventId) });
      addNotification({
        type: 'success',
        message: 'Accessibility requirements profile updated successfully.',
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        message: err.message || 'Failed to update accessibility profile.',
      });
    },
  });
};

export const useUpdateVenueAccessibilityMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: (data: VenueAccessibilityInput) =>
      accessibilityApi.updateVenue(eventId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(ACCESSIBILITY_QUERY_KEYS.event(eventId), data);
      queryClient.invalidateQueries({ queryKey: ACCESSIBILITY_QUERY_KEYS.event(eventId) });
      addNotification({
        type: 'success',
        message: 'Venue verification details saved.',
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        message: err.message || 'Failed to update venue verification details.',
      });
    },
  });
};

export const useGenerateAccessibilityPlanMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  return useMutation({
    mutationFn: () => accessibilityApi.generatePlan(eventId),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ACCESSIBILITY_QUERY_KEYS.event(eventId) });
      addNotification({
        type: 'success',
        message: `Accessibility plan generated with ${plan.why_this_plan.coverage_score}% coverage!`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        message: err.message || 'Failed to generate accessibility plan.',
      });
    },
  });
};

