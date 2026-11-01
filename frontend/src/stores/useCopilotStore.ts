import { create } from 'zustand';
import { AICopilotChatMessage } from '@/types/copilot';

const INITIAL_COPILOT_GREETING: AICopilotChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Hello! I am your AI Event Planning Copilot. How can I help you design, budget, or sequence your upcoming event today?',
    suggestedActions: [
      'Review my current event budget',
      'Identify overdue timeline milestones',
      'Review my vendor booking progress',
    ],
  },
];

interface CopilotStoreState {
  isOpen: boolean;
  activeThreadId: string | null;
  isThreadsListOpen: boolean;
  draftMessage: string;
  isLoading: boolean;
  isFallbackActive: boolean;
  messages: AICopilotChatMessage[];
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setActiveThreadId: (threadId: string | null) => void;
  setIsThreadsListOpen: (isOpen: boolean) => void;
  setDraftMessage: (message: string) => void;
  setLoading: (loading: boolean) => void;
  setFallbackActive: (active: boolean) => void;
  addMessage: (message: AICopilotChatMessage) => void;
  clearMessages: () => void;
  resetCopilotState: () => void;
}

export const useCopilotStore = create<CopilotStoreState>((set) => ({
  isOpen: false,
  activeThreadId: null,
  isThreadsListOpen: false,
  draftMessage: '',
  isLoading: false,
  isFallbackActive: false,
  messages: INITIAL_COPILOT_GREETING,
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setActiveThreadId: (threadId) => set({ activeThreadId: threadId }),
  setIsThreadsListOpen: (isOpen) => set({ isThreadsListOpen: isOpen }),
  setDraftMessage: (message) => set({ draftMessage: message }),
  setLoading: (loading) => set({ isLoading: loading }),
  setFallbackActive: (active) => set({ isFallbackActive: active }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
  resetCopilotState: () =>
    set({
      isOpen: false,
      activeThreadId: null,
      isThreadsListOpen: false,
      draftMessage: '',
      isLoading: false,
      isFallbackActive: false,
      messages: INITIAL_COPILOT_GREETING,
    }),
}));
