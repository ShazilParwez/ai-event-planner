import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guestsApi, GuestQueryParams } from './api';
import { GuestCreatePayload, GuestUpdatePayload } from '@/types/guest';

export const GUEST_QUERY_KEYS = {
  all: ['guests'] as const,
  list: (eventId: string, params?: GuestQueryParams) =>
    ['guests', 'list', eventId, params] as const,
  analytics: (eventId: string) => ['guests', 'analytics', eventId] as const,
};

export const useGuestsQuery = (eventId: string | null, params?: GuestQueryParams) => {
  return useQuery({
    queryKey: GUEST_QUERY_KEYS.list(eventId || '', params),
    queryFn: () => guestsApi.getGuests(eventId!, params),
    enabled: Boolean(eventId),
  });
};

export const useGuestAnalyticsQuery = (eventId: string | null) => {
  return useQuery({
    queryKey: GUEST_QUERY_KEYS.analytics(eventId || ''),
    queryFn: () => guestsApi.getAnalytics(eventId!),
    enabled: Boolean(eventId),
  });
};

export const useCreateGuestMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GuestCreatePayload) => guestsApi.createGuest(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUEST_QUERY_KEYS.all });
    },
  });
};

export const useUpdateGuestMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, data }: { guestId: string; data: GuestUpdatePayload }) =>
      guestsApi.updateGuest(eventId, guestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUEST_QUERY_KEYS.all });
    },
  });
};

export const useDeleteGuestMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => guestsApi.deleteGuest(eventId, guestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUEST_QUERY_KEYS.all });
    },
  });
};

export const useUpdateGuestRSVPMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, rsvpStatus }: { guestId: string; rsvpStatus: string }) =>
      guestsApi.updateGuestRSVP(eventId, guestId, rsvpStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUEST_QUERY_KEYS.all });
    },
  });
};

export const useUpdateGuestInvitationMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, invitationStatus }: { guestId: string; invitationStatus: string }) =>
      guestsApi.updateGuestInvitation(eventId, guestId, invitationStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GUEST_QUERY_KEYS.all });
    },
  });
};

