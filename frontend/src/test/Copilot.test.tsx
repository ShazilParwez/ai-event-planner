import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CopilotDrawer } from '../features/copilot/CopilotDrawer';
import { CopilotChatView } from '../features/copilot/CopilotChatView';
import { CopilotThreadList } from '../features/copilot/CopilotThreadList';
import { CopilotActionCard } from '../features/copilot/CopilotActionCard';
import { MarkdownContent } from '../features/copilot/MarkdownContent';
import { useCopilotStore } from '../stores/useCopilotStore';
import { useEventStore } from '../stores/useEventStore';
import { copilotApi } from '../features/copilot/api';
import {
  CopilotThread,
  CopilotMessage,
  CopilotProposedAction,
} from '../types/copilot';
import { Event } from '../types/event';

// Mock copilot API methods
vi.mock('../features/copilot/api', () => ({
  copilotApi: {
    getThreads: vi.fn(),
    createThread: vi.fn(),
    deleteThread: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    executeAction: vi.fn(),
    dismissAction: vi.fn(),
  },
}));

// Mock events hooks
const mockEvent: Event = {
  id: 'event-jaipur-1',
  title: 'Royal Rajasthan Wedding',
  event_type: 'WEDDING',
  target_budget: 5000000,
  currency: 'INR',
  expected_guest_count: 350,
  start_date: '2026-12-10T10:00:00Z',
  end_date: '2026-12-12T22:00:00Z',
  location: 'City Palace, Jaipur',
  description: 'Grand Royal Wedding Celebration',
  status: 'PLANNING',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

vi.mock('../features/events/hooks', () => ({
  useEventsQuery: () => ({
    data: [mockEvent],
    isLoading: false,
    error: null,
  }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('AI Event Copilot Frontend Test Suite', () => {
  const mockThreads: CopilotThread[] = [
    {
      id: 'thread-1',
      event_id: 'event-jaipur-1',
      title: 'Budget Allocation Chat',
      created_at: '2026-11-01T08:00:00Z',
      updated_at: '2026-11-01T08:15:00Z',
      message_count: 3,
    },
    {
      id: 'thread-2',
      event_id: 'event-jaipur-1',
      title: 'Vendor Sourcing Chat',
      created_at: '2026-11-01T09:00:00Z',
      updated_at: '2026-11-01T09:10:00Z',
      message_count: 1,
    },
  ];

  const mockProposedMilestone: CopilotProposedAction = {
    action_id: 'act-milestone-1',
    action_type: 'ADD_TIMELINE_MILESTONE',
    title: 'Book Wedding Caterer by November',
    description: 'Ensure traditional Rajasthani royal banquet menu is contracted.',
    parameters: {
      phase: 'PROCUREMENT',
      priority: 'HIGH',
      due_date: '2026-11-20',
    },
    status: 'PENDING',
  };

  const mockProposedExpense: CopilotProposedAction = {
    action_id: 'act-expense-1',
    action_type: 'ADD_BUDGET_EXPENSE',
    title: 'Mandap Floral Styling Decor',
    description: 'Marigold and jasmine floral structures.',
    parameters: {
      category_name: 'Decoration',
      estimated_cost: 150000,
      status: 'ESTIMATED',
    },
    status: 'PENDING',
  };

  const mockProposedVendor: CopilotProposedAction = {
    action_id: 'act-vendor-1',
    action_type: 'ADD_VENDOR_ITEM',
    title: 'Heritage Palace Live Orchestra',
    description: 'Folk musicians and shehnai players for welcome.',
    parameters: {
      category: 'Entertainment',
      estimated_quote: 80000,
      final_agreed_price: 75000,
    },
    status: 'PENDING',
  };

  const mockMessages: CopilotMessage[] = [
    {
      id: 'msg-1',
      thread_id: 'thread-1',
      event_id: 'event-jaipur-1',
      role: 'user',
      content: 'Can you review our catering budget and suggest next milestones?',
      suggested_prompts: [],
      warnings: [],
      proposed_actions: [],
      source: 'user',
      created_at: '2026-11-01T08:00:00Z',
    },
    {
      id: 'msg-2',
      thread_id: 'thread-1',
      event_id: 'event-jaipur-1',
      role: 'assistant',
      content:
        '### Catering & Timeline Review\nBased on your 350 guest count, here is our recommended roadmap:\n- **Allocate ₹15,00,000** for royal banquet buffet\n- Secure caterer deposit by mid-November',
      suggested_prompts: [
        'Review my current event budget',
        'Identify overdue timeline milestones',
      ],
      warnings: [
        {
          warning_type: 'BUDGET_OVERRUN',
          severity: 'HIGH',
          message: 'Catering allocation exceeds target proportion by 8%',
        },
      ],
      proposed_actions: [mockProposedMilestone, mockProposedExpense],
      source: 'gemini',
      created_at: '2026-11-01T08:01:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useCopilotStore.setState({
      isOpen: true,
      activeThreadId: 'thread-1',
      isThreadsListOpen: false,
      draftMessage: '',
      isLoading: false,
      isFallbackActive: false,
    });
    useEventStore.setState({
      activeEvent: mockEvent,
      activeEventId: mockEvent.id,
    });

    vi.mocked(copilotApi.getThreads).mockResolvedValue(mockThreads);
    vi.mocked(copilotApi.getMessages).mockResolvedValue(mockMessages);
  });

  // 1. Drawer open, close, and escape behavior
  it('renders open Copilot drawer with title and active event name', async () => {
    renderWithClient(<CopilotDrawer />);

    expect(screen.getByText('AI Event Copilot')).toBeInTheDocument();
    expect(screen.getByText('Royal Rajasthan Wedding')).toBeInTheDocument();
    expect(screen.getByText('INR')).toBeInTheDocument();
  });

  it('closes Copilot drawer when close button is clicked', async () => {
    renderWithClient(<CopilotDrawer />);

    const closeBtn = screen.getByLabelText('Close AI Copilot');
    fireEvent.click(closeBtn);

    expect(useCopilotStore.getState().isOpen).toBe(false);
  });

  it('closes Copilot drawer when Escape key is pressed', async () => {
    renderWithClient(<CopilotDrawer />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useCopilotStore.getState().isOpen).toBe(false);
  });

  // 2. Event selection behavior
  it('displays empty state when no event is selected', async () => {
    useEventStore.setState({ activeEvent: null, activeEventId: null });
    vi.mock('../features/events/hooks', () => ({
      useEventsQuery: () => ({ data: [], isLoading: false }),
    }));

    renderWithClient(<CopilotDrawer />);
    expect(screen.getByText('No Event Selected')).toBeInTheDocument();
  });

  // 3. Thread listing, creation, and switching
  it('renders conversation threads list and switches active thread', async () => {
    renderWithClient(<CopilotThreadList eventId="event-jaipur-1" />);

    await waitFor(() => {
      expect(screen.getByText('Budget Allocation Chat')).toBeInTheDocument();
      expect(screen.getByText('Vendor Sourcing Chat')).toBeInTheDocument();
    });

    // Click thread 2 to switch active thread
    const thread2 = screen.getByText('Vendor Sourcing Chat');
    fireEvent.click(thread2);

    expect(useCopilotStore.getState().activeThreadId).toBe('thread-2');
  });

  it('creates a new conversation thread when New Chat button is clicked', async () => {
    const newThread: CopilotThread = {
      id: 'thread-new',
      event_id: 'event-jaipur-1',
      title: 'New Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    };
    vi.mocked(copilotApi.createThread).mockResolvedValue(newThread);

    renderWithClient(<CopilotThreadList eventId="event-jaipur-1" />);

    const newChatBtn = screen.getByRole('button', { name: /New Chat/i });
    fireEvent.click(newChatBtn);

    await waitFor(() => {
      expect(copilotApi.createThread).toHaveBeenCalledWith(
        'event-jaipur-1',
        'New Chat'
      );
    });
  });

  it('deletes a conversation thread after confirmation', async () => {
    vi.mocked(copilotApi.deleteThread).mockResolvedValue();

    renderWithClient(<CopilotThreadList eventId="event-jaipur-1" />);

    await waitFor(() => {
      expect(screen.getByText('Budget Allocation Chat')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText(
      'Delete conversation Budget Allocation Chat'
    );
    fireEvent.click(deleteBtn);

    // Confirm button appears
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(copilotApi.deleteThread).toHaveBeenCalledWith(
        'event-jaipur-1',
        'thread-1'
      );
    });
  });

  // 4. Message history and source attribution rendering
  it('renders message bubbles, markdown content, and source badges', async () => {
    renderWithClient(
      <CopilotChatView eventId="event-jaipur-1" threadId="thread-1" />
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Can you review our catering budget and suggest next milestones?'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Catering & Timeline Review')).toBeInTheDocument();
      expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
    });
  });

  it('displays contextual warnings in assistant messages', async () => {
    renderWithClient(
      <CopilotChatView eventId="event-jaipur-1" threadId="thread-1" />
    );

    await waitFor(() => {
      expect(screen.getByText(/\[BUDGET_OVERRUN\]/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Catering allocation exceeds target proportion/i)
      ).toBeInTheDocument();
    });
  });

  // 5. Sending messages and suggested prompt clicks
  it('submits a message when typing and clicking Send button', async () => {
    vi.mocked(copilotApi.sendMessage).mockResolvedValue({
      response: 'Catering milestone has been noted.',
      suggested_prompts: [],
      proposed_actions: [],
      warnings: [],
      source: 'gemini',
    });

    renderWithClient(
      <CopilotChatView eventId="event-jaipur-1" threadId="thread-1" />
    );

    const textarea = screen.getByLabelText('Message input for AI Copilot');
    fireEvent.change(textarea, {
      target: { value: 'How many waiters do we need for 350 guests?' },
    });

    const sendBtn = screen.getByLabelText('Send message to AI Copilot');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(copilotApi.sendMessage).toHaveBeenCalledWith(
        'event-jaipur-1',
        'thread-1',
        'How many waiters do we need for 350 guests?'
      );
    });
  });

  it('triggers message send when clicking a suggested prompt chip', async () => {
    vi.mocked(copilotApi.sendMessage).mockResolvedValue({
      response: 'Budget analysis complete.',
      suggested_prompts: [],
      proposed_actions: [],
      warnings: [],
      source: 'gemini',
    });

    renderWithClient(
      <CopilotChatView eventId="event-jaipur-1" threadId="thread-1" />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Review my current event budget' })
      ).toBeInTheDocument();
    });

    const promptBtn = screen.getByRole('button', {
      name: 'Review my current event budget',
    });
    fireEvent.click(promptBtn);

    await waitFor(() => {
      expect(copilotApi.sendMessage).toHaveBeenCalledWith(
        'event-jaipur-1',
        'thread-1',
        'Review my current event budget'
      );
    });
  });

  // 6. Interactive Action Proposal Cards: Approval, Dismissal, Execution States
  it('renders action proposal cards for authorized types', async () => {
    renderWithClient(
      <CopilotChatView eventId="event-jaipur-1" threadId="thread-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('Timeline Milestone')).toBeInTheDocument();
      expect(
        screen.getByText('Book Wedding Caterer by November')
      ).toBeInTheDocument();
      expect(screen.getByText('Budget Expense')).toBeInTheDocument();
      expect(
        screen.getByText('Mandap Floral Styling Decor')
      ).toBeInTheDocument();
    });
  });

  it('executes an action proposal when Approve & Apply is clicked', async () => {
    vi.mocked(copilotApi.executeAction).mockResolvedValue({
      action_id: 'act-milestone-1',
      status: 'EXECUTED',
      action_type: 'ADD_TIMELINE_MILESTONE',
      created_resource_id: 'ms-created-1',
      details: { title: 'Book Wedding Caterer by November' },
      message: 'Milestone created successfully',
    });

    renderWithClient(
      <CopilotActionCard
        action={mockProposedMilestone}
        eventId="event-jaipur-1"
        threadId="thread-1"
        currency="INR"
      />
    );

    const approveBtn = screen.getByRole('button', { name: /Approve & Apply/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(copilotApi.executeAction).toHaveBeenCalledWith(
        'event-jaipur-1',
        'act-milestone-1',
        'thread-1'
      );
    });
  });

  it('dismisses an action proposal when Dismiss is clicked', async () => {
    vi.mocked(copilotApi.dismissAction).mockResolvedValue({
      action_id: 'act-expense-1',
      status: 'DISMISSED',
      message: 'Action dismissed',
    });

    renderWithClient(
      <CopilotActionCard
        action={mockProposedExpense}
        eventId="event-jaipur-1"
        threadId="thread-1"
        currency="INR"
      />
    );

    const dismissBtn = screen.getByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(copilotApi.dismissAction).toHaveBeenCalledWith(
        'event-jaipur-1',
        'act-expense-1',
        'thread-1'
      );
    });
  });

  it('displays error message if action execution fails and preserves pending state', async () => {
    vi.mocked(copilotApi.executeAction).mockRejectedValue(
      new Error('Advance paid cannot exceed agreed/quoted cost ceiling.')
    );

    renderWithClient(
      <CopilotActionCard
        action={mockProposedVendor}
        eventId="event-jaipur-1"
        threadId="thread-1"
        currency="INR"
      />
    );

    const approveBtn = screen.getByRole('button', { name: /Approve & Apply/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Advance paid cannot exceed agreed\/quoted cost ceiling/i)
      ).toBeInTheDocument();
    });
  });

  it('renders EXECUTED action state with confirmation badge', () => {
    const executedAction: CopilotProposedAction = {
      ...mockProposedMilestone,
      status: 'EXECUTED',
    };

    renderWithClient(
      <CopilotActionCard
        action={executedAction}
        eventId="event-jaipur-1"
        threadId="thread-1"
      />
    );

    expect(screen.getByText('Applied & Verified')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Approve & Apply/i })
    ).not.toBeInTheDocument();
  });

  it('renders DISMISSED action state with dismissed pill', () => {
    const dismissedAction: CopilotProposedAction = {
      ...mockProposedExpense,
      status: 'DISMISSED',
    };

    renderWithClient(
      <CopilotActionCard
        action={dismissedAction}
        eventId="event-jaipur-1"
        threadId="thread-1"
      />
    );

    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Approve & Apply/i })
    ).not.toBeInTheDocument();
  });

  // 7. Markdown formatter unit test
  it('renders formatted markdown headings, bold text, and lists correctly', () => {
    const markdown = `# Main Title\n## Subtitle\n**Important Milestone**\n- Item 1\n- Item 2\n1. First task\n\`const budget = 50000;\``;
    render(<MarkdownContent content={markdown} />);

    expect(screen.getByText('Main Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
    expect(screen.getByText('Important Milestone')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('First task')).toBeInTheDocument();
    expect(screen.getByText('const budget = 50000;')).toBeInTheDocument();
  });
});
