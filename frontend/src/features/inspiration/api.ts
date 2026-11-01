import { apiClient } from '@/lib/api-client';
import {
  InspirationCard,
  InspirationCardCreatePayload,
  InspirationCardUpdatePayload,
  InspirationGenerateRequestPayload,
  InspirationGenerateResponse,
} from '@/types/inspiration';

export interface InspirationQueryParams {
  category?: string | undefined;
  is_saved?: boolean | undefined;
}

export const inspirationApi = {
  getCards: async (
    eventId: string,
    params?: InspirationQueryParams
  ): Promise<InspirationCard[]> => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.is_saved !== undefined) query.set('is_saved', String(params.is_saved));
    const qs = query.toString();
    return apiClient.get<InspirationCard[]>(`/events/${eventId}/inspiration${qs ? `?${qs}` : ''}`);
  },

  createCard: async (
    eventId: string,
    data: InspirationCardCreatePayload
  ): Promise<InspirationCard> => {
    return apiClient.post<InspirationCard>(`/events/${eventId}/inspiration/cards`, data);
  },

  updateCard: async (
    eventId: string,
    cardId: string,
    data: InspirationCardUpdatePayload
  ): Promise<InspirationCard> => {
    return apiClient.put<InspirationCard>(`/events/${eventId}/inspiration/cards/${cardId}`, data);
  },

  deleteCard: async (eventId: string, cardId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/inspiration/cards/${cardId}`);
  },

  toggleSaveCard: async (eventId: string, cardId: string): Promise<InspirationCard> => {
    return apiClient.patch<InspirationCard>(
      `/events/${eventId}/inspiration/cards/${cardId}/toggle-save`,
      {}
    );
  },

  generateIdeas: async (
    eventId: string,
    data: InspirationGenerateRequestPayload
  ): Promise<InspirationGenerateResponse> => {
    return apiClient.post<InspirationGenerateResponse>(
      `/events/${eventId}/inspiration/generate`,
      data
    );
  },
};
