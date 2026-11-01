import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimelineView } from '../features/timeline/TimelineView';
import { MilestoneModal } from '../features/timeline/MilestoneModal';
import { ActivityModal } from '../features/timeline/ActivityModal';
import { useEventStore } from '../stores/useEventStore';
import { TimelineOverview, TimelineMilestone } from '../types/timeline';

// Mock timeline API
vi.mock('../features/timeline/api', () => ({
  timelineApi: {
    getTimeline: vi.fn(),
    createMilestone: vi.fn(),
    seedMilestones: vi.fn(),
    updateMilestone: vi.fn(),
    deleteMilestone: vi.fn(),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
  },
}));

import { timelineApi } from '../features/timeline/api';

describe('Timeline Management Component Tests', () => {
  let queryClient: QueryClient;

  const mockMilestones: TimelineMilestone[] = [
    {
      id: 'ms-1',
      event_id: 'event-1',
      title: 'Confirm Heritage Palace Venue',
      phase: '5_MONTHS_BEFORE',
      target_date: '2026-11-20T10:00:00Z',
      due_date: '2026-11-20T10:00:00Z',
      status: 'PENDING',
      priority: 'CRITICAL',
      description: 'Sign contract and transfer deposit',
      order_index: 0,
      is_ai_suggested: false,
      is_completed: false,
      is_overdue: false,
      activities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'ms-2',
      event_id: 'event-1',
      title: 'Invitations & Guest Directory',
      phase: '3_MONTHS_BEFORE',
      target_date: '2026-10-15T10:00:00Z', // past date -> overdue
      due_date: '2026-10-15T10:00:00Z',
      status: 'PENDING',
      priority: 'HIGH',
      description: 'Send physical cards and launch RSVP site',
      order_index: 1,
      is_ai_suggested: false,
      is_completed: false,
      is_overdue: true,
      activities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockOverview: TimelineOverview = {
    event_id: 'event-1',
    total_milestones: 2,
    completed_milestones: 0,
    pending_milestones: 2,
    overdue_milestones: 1,
    completion_percentage: 0,
    milestones: mockMilestones,
    activities: [
      {
        id: 'act-1',
        event_id: 'event-1',
        milestone_id: 'ms-1',
        title: 'Royal Welcome Ceremony & Dhol Tasha',
        start_time: '2026-11-25T11:00:00Z',
        end_time: '2026-11-25T12:30:00Z',
        responsible_party: 'Event Coordinator',
        location: 'Palace Main Gate',
        status: 'SCHEDULED',
        order_index: 0,
        description: 'Floral showers and welcome drinks for arriving guests',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    useEventStore.getState().setActiveEvent({
      id: 'event-1',
      name: 'Pooja & Rohan Royal Wedding',
      title: 'Pooja & Rohan Royal Wedding',
      event_type: 'WEDDING',
      description: 'Grand royal wedding celebration',
      location: 'Udaipur, Rajasthan',
      start_date: '2026-11-25T00:00:00Z',
      end_date: '2026-11-27T00:00:00Z',
      expected_guest_count: 350,
      target_budget: 4500000,
      total_budget: 4500000,
      currency: 'INR',
      status: 'PLANNING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('renders timeline overview KPI cards and milestones list', async () => {
    vi.mocked(timelineApi.getTimeline).mockResolvedValue(mockOverview);

    render(
      <QueryClientProvider client={queryClient}>
        <TimelineView />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Confirm Heritage Palace Venue')).toBeInTheDocument();
    expect(screen.getByText('Invitations & Guest Directory')).toBeInTheDocument();

    // Verify overdue indicator
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();

    // Verify KPI numbers
    expect(screen.getByText('Total Milestones')).toBeInTheDocument();
    expect(screen.getByText('Overdue Milestones')).toBeInTheDocument();
  });

  it('submits milestone creation form with title and priority', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MilestoneModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={mockSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Finalize Palace Catering Contract/i);
    fireEvent.change(titleInput, { target: { value: 'Hire Mehendi & Makeup Artists' } });

    const submitBtn = screen.getByRole('button', { name: /Create Milestone/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Hire Mehendi & Makeup Artists',
          priority: 'MEDIUM',
          status: 'PENDING',
        })
      );
    });
  });

  it('submits activity schedule form with start and end times', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ActivityModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={mockSubmit}
        milestones={mockMilestones}
      />
    );

    const titleInput = screen.getByPlaceholderText(/Royal Baraat Procession/i);
    fireEvent.change(titleInput, { target: { value: 'Sangeet Choreography Rehearsal' } });

    const submitBtn = screen.getByRole('button', { name: /Schedule Activity/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sangeet Choreography Rehearsal',
          status: 'SCHEDULED',
        })
      );
    });
  });

  it('switches to Day-Of Itinerary tab and displays scheduled activities', async () => {
    vi.mocked(timelineApi.getTimeline).mockResolvedValue(mockOverview);

    render(
      <QueryClientProvider client={queryClient}>
        <TimelineView />
      </QueryClientProvider>
    );

    const itineraryTab = await screen.findByRole('button', {
      name: /Day-Of Itinerary & Run of Show/i,
    });
    fireEvent.click(itineraryTab);

    expect(
      await screen.findByText('Royal Welcome Ceremony & Dhol Tasha')
    ).toBeInTheDocument();
    expect(screen.getByText('Palace Main Gate')).toBeInTheDocument();
    expect(screen.getByText(/Lead: Event Coordinator/i)).toBeInTheDocument();
  });
});

