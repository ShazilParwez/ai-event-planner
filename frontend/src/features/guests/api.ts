import { apiClient } from '@/lib/api-client';
import {
  Guest,
  GuestListResponse,
  GuestAnalytics,
  GuestCreatePayload,
  GuestUpdatePayload,
} from '@/types/guest';

export interface GuestQueryParams {
  search?: string | undefined;
  category?: string | undefined;
  rsvp_status?: string | undefined;
  invitation_status?: string | undefined;
  page?: number | undefined;
  page_size?: number | undefined;
}

export const guestsApi = {
  getGuests: async (
    eventId: string,
    params?: GuestQueryParams
  ): Promise<GuestListResponse> => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category);
    if (params?.rsvp_status) query.set('rsvp_status', params.rsvp_status);
    if (params?.invitation_status) query.set('invitation_status', params.invitation_status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.page_size) query.set('page_size', params.page_size.toString());
    const qs = query.toString();
    return apiClient.get<GuestListResponse>(`/events/${eventId}/guests${qs ? `?${qs}` : ''}`);
  },

  getAnalytics: async (eventId: string): Promise<GuestAnalytics> => {
    return apiClient.get<GuestAnalytics>(`/events/${eventId}/guests/analytics`);
  },

  createGuest: async (
    eventId: string,
    data: GuestCreatePayload
  ): Promise<Guest> => {
    return apiClient.post<Guest>(`/events/${eventId}/guests`, data);
  },

  updateGuest: async (
    eventId: string,
    guestId: string,
    data: GuestUpdatePayload
  ): Promise<Guest> => {
    return apiClient.put<Guest>(`/events/${eventId}/guests/${guestId}`, data);
  },

  deleteGuest: async (eventId: string, guestId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/guests/${guestId}`);
  },

  updateGuestRSVP: async (
    eventId: string,
    guestId: string,
    rsvpStatus: string
  ): Promise<Guest> => {
    return apiClient.patch<Guest>(`/events/${eventId}/guests/${guestId}/rsvp`, {
      rsvp_status: rsvpStatus,
    });
  },

  updateGuestInvitation: async (
    eventId: string,
    guestId: string,
    invitationStatus: string
  ): Promise<Guest> => {
    return apiClient.patch<Guest>(`/events/${eventId}/guests/${guestId}/invitation`, {
      invitation_status: invitationStatus,
    });
  },
};
