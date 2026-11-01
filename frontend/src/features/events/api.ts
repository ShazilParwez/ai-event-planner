import { apiClient } from '@/lib/api-client';
import { Event, EventCreateInput, EventUpdateInput } from '@/types/event';

export const eventsApi = {
  getEvents: async (params?: {
    skip?: number | undefined;
    limit?: number | undefined;
    event_type?: string | undefined;
    status?: string | undefined;
    search?: string | undefined;
  }): Promise<Event[]> => {
    const query = new URLSearchParams();
    if (params?.skip !== undefined) query.set('skip', params.skip.toString());
    if (params?.limit !== undefined) query.set('limit', params.limit.toString());
    if (params?.event_type) query.set('event_type', params.event_type);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    const qs = query.toString();
    return apiClient.get<Event[]>(`/events${qs ? `?${qs}` : ''}`);
  },

  getEvent: async (id: string): Promise<Event> => {
    return apiClient.get<Event>(`/events/${id}`);
  },

  createEvent: async (data: EventCreateInput): Promise<Event> => {
    return apiClient.post<Event>('/events', data);
  },

  updateEvent: async (id: string, data: EventUpdateInput): Promise<Event> => {
    return apiClient.put<Event>(`/events/${id}`, data);
  },

  deleteEvent: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${id}`);
  },
};
