import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspirationApi, InspirationQueryParams } from './api';
import {
  InspirationCardCreatePayload,
  InspirationCardUpdatePayload,
  InspirationGenerateRequestPayload,
} from '@/types/inspiration';

export const INSPIRATION_QUERY_KEYS = {
  all: ['inspiration'] as const,
  cards: (eventId: string, params?: InspirationQueryParams) =>
    ['inspiration', 'cards', eventId, params] as const,
};

export const useInspirationCardsQuery = (
  eventId: string | null,
  params?: InspirationQueryParams
) => {
  return useQuery({
    queryKey: INSPIRATION_QUERY_KEYS.cards(eventId || '', params),
    queryFn: () => inspirationApi.getCards(eventId!, params),
    enabled: Boolean(eventId),
  });
};

export const useCreateInspirationCardMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InspirationCardCreatePayload) =>
      inspirationApi.createCard(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPIRATION_QUERY_KEYS.all });
    },
  });
};

export const useUpdateInspirationCardMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: InspirationCardUpdatePayload }) =>
      inspirationApi.updateCard(eventId, cardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPIRATION_QUERY_KEYS.all });
    },
  });
};

export const useDeleteInspirationCardMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => inspirationApi.deleteCard(eventId, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPIRATION_QUERY_KEYS.all });
    },
  });
};

export const useToggleSaveInspirationCardMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => inspirationApi.toggleSaveCard(eventId, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSPIRATION_QUERY_KEYS.all });
    },
  });
};

export const useGenerateInspirationMutation = (eventId: string) => {
  return useMutation({
    mutationFn: (data: InspirationGenerateRequestPayload) =>
      inspirationApi.generateIdeas(eventId, data),
  });
};

