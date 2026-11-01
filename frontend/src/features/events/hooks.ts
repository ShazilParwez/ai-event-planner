import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from './api';
import { EventCreateInput, EventUpdateInput } from '@/types/event';
import { useEventStore } from '@/stores/useEventStore';

export const EVENT_QUERY_KEYS = {
  all: ['events'] as const,
  list: (filters?: Record<string, unknown>) => ['events', 'list', filters] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
};

export const useEventsQuery = (filters?: {
  skip?: number | undefined;
  limit?: number | undefined;
  event_type?: string | undefined;
  status?: string | undefined;
  search?: string | undefined;
}) => {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.list(filters),
    queryFn: () => eventsApi.getEvents(filters),
  });
};

export const useEventQuery = (id: string | null) => {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.detail(id || ''),
    queryFn: () => eventsApi.getEvent(id!),
    enabled: Boolean(id),
  });
};

export const useCreateEventMutation = () => {
  const queryClient = useQueryClient();
  const setActiveEvent = useEventStore((state) => state.setActiveEvent);

  return useMutation({
    mutationFn: (data: EventCreateInput) => eventsApi.createEvent(data),
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.all });
      setActiveEvent(newEvent);
    },
  });
};

export const useUpdateEventMutation = () => {
  const queryClient = useQueryClient();
  const setActiveEvent = useEventStore((state) => state.setActiveEvent);
  const activeEvent = useEventStore((state) => state.activeEvent);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EventUpdateInput }) =>
      eventsApi.updateEvent(id, data),
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.detail(updatedEvent.id) });
      if (activeEvent?.id === updatedEvent.id) {
        setActiveEvent(updatedEvent);
      }
    },
  });
};

export const useDeleteEventMutation = () => {
  const queryClient = useQueryClient();
  const setActiveEvent = useEventStore((state) => state.setActiveEvent);
  const activeEvent = useEventStore((state) => state.activeEvent);

  return useMutation({
    mutationFn: (id: string) => eventsApi.deleteEvent(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.all });
      if (activeEvent?.id === deletedId) {
        setActiveEvent(null);
      }
    },
  });
};
