import { apiClient } from '@/lib/api-client';
import {
  CopilotThread,
  CopilotMessage,
  AICopilotChatResponse,
  CopilotActionExecuteResponse,
  CopilotActionDismissResponse,
} from '@/types/copilot';

export const copilotApi = {
  getThreads: async (eventId: string): Promise<CopilotThread[]> => {
    return apiClient.get<CopilotThread[]>(`/events/${eventId}/copilot/threads`);
  },

  createThread: async (
    eventId: string,
    title: string = 'New Chat'
  ): Promise<CopilotThread> => {
    return apiClient.post<CopilotThread>(`/events/${eventId}/copilot/threads`, {
      title,
    });
  },

  deleteThread: async (eventId: string, threadId: string): Promise<void> => {
    return apiClient.delete<void>(`/events/${eventId}/copilot/threads/${threadId}`);
  },

  getMessages: async (
    eventId: string,
    threadId: string
  ): Promise<CopilotMessage[]> => {
    return apiClient.get<CopilotMessage[]>(
      `/events/${eventId}/copilot/threads/${threadId}/messages`
    );
  },

  sendMessage: async (
    eventId: string,
    threadId: string,
    content: string
  ): Promise<AICopilotChatResponse> => {
    return apiClient.post<AICopilotChatResponse>(
      `/events/${eventId}/copilot/threads/${threadId}/messages`,
      { content }
    );
  },

  executeAction: async (
    eventId: string,
    actionId: string,
    threadId?: string
  ): Promise<CopilotActionExecuteResponse> => {
    const url = threadId
      ? `/events/${eventId}/copilot/threads/${threadId}/actions/${actionId}/execute`
      : `/events/${eventId}/copilot/actions/${actionId}/execute`;
    return apiClient.post<CopilotActionExecuteResponse>(url);
  },

  dismissAction: async (
    eventId: string,
    actionId: string,
    threadId?: string
  ): Promise<CopilotActionDismissResponse> => {
    const url = threadId
      ? `/events/${eventId}/copilot/threads/${threadId}/actions/${actionId}/dismiss`
      : `/events/${eventId}/copilot/actions/${actionId}/dismiss`;
    return apiClient.post<CopilotActionDismissResponse>(url);
  },
};

