import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { copilotApi } from './api';
import { useCopilotStore } from '@/stores/useCopilotStore';

export const COPILOT_QUERY_KEYS = {
  all: ['copilot'] as const,
  threads: (eventId: string) => ['copilot', 'threads', eventId] as const,
  messages: (eventId: string, threadId: string) =>
    ['copilot', 'messages', eventId, threadId] as const,
};

export const useCopilotThreadsQuery = (eventId: string | null) => {
  return useQuery({
    queryKey: COPILOT_QUERY_KEYS.threads(eventId || ''),
    queryFn: () => copilotApi.getThreads(eventId!),
    enabled: Boolean(eventId),
  });
};

export const useCreateCopilotThreadMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  const setActiveThreadId = useCopilotStore((state) => state.setActiveThreadId);
  const setIsThreadsListOpen = useCopilotStore(
    (state) => state.setIsThreadsListOpen
  );

  return useMutation({
    mutationFn: (title: string = 'New Chat') =>
      copilotApi.createThread(eventId, title),
    onSuccess: (newThread) => {
      queryClient.invalidateQueries({
        queryKey: COPILOT_QUERY_KEYS.threads(eventId),
      });
      setActiveThreadId(newThread.id);
      setIsThreadsListOpen(false);
    },
  });
};

export const useDeleteCopilotThreadMutation = (eventId: string) => {
  const queryClient = useQueryClient();
  const activeThreadId = useCopilotStore((state) => state.activeThreadId);
  const setActiveThreadId = useCopilotStore((state) => state.setActiveThreadId);

  return useMutation({
    mutationFn: (threadId: string) =>
      copilotApi.deleteThread(eventId, threadId),
    onSuccess: (_, deletedThreadId) => {
      queryClient.invalidateQueries({
        queryKey: COPILOT_QUERY_KEYS.threads(eventId),
      });
      if (activeThreadId === deletedThreadId) {
        setActiveThreadId(null);
      }
    },
  });
};

export const useCopilotMessagesQuery = (
  eventId: string | null,
  threadId: string | null
) => {
  return useQuery({
    queryKey: COPILOT_QUERY_KEYS.messages(eventId || '', threadId || ''),
    queryFn: () => copilotApi.getMessages(eventId!, threadId!),
    enabled: Boolean(eventId && threadId),
  });
};

export const useSendCopilotMessageMutation = (
  eventId: string,
  threadId: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      copilotApi.sendMessage(eventId, threadId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: COPILOT_QUERY_KEYS.messages(eventId, threadId),
      });
      queryClient.invalidateQueries({
        queryKey: COPILOT_QUERY_KEYS.threads(eventId),
      });
    },
  });
};

export const useExecuteCopilotActionMutation = (
  eventId: string,
  threadId?: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) =>
      copilotApi.executeAction(eventId, actionId, threadId),
    onSuccess: () => {
      // Invalidate copilot messages to show EXECUTED state
      if (threadId) {
        queryClient.invalidateQueries({
          queryKey: COPILOT_QUERY_KEYS.messages(eventId, threadId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: COPILOT_QUERY_KEYS.all,
        });
      }
      // Invalidate relevant domain query caches
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
};

export const useDismissCopilotActionMutation = (
  eventId: string,
  threadId?: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (actionId: string) =>
      copilotApi.dismissAction(eventId, actionId, threadId),
    onSuccess: () => {
      if (threadId) {
        queryClient.invalidateQueries({
          queryKey: COPILOT_QUERY_KEYS.messages(eventId, threadId),
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: COPILOT_QUERY_KEYS.all,
        });
      }
    },
  });
};

