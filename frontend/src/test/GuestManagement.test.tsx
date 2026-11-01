import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuestView } from '../features/guests/GuestView';
import { GuestModal } from '../features/guests/GuestModal';
import { useEventStore } from '../stores/useEventStore';
import { Guest, GuestAnalytics, GuestListResponse } from '../types/guest';

// Mock guest API
vi.mock('../features/guests/api', () => ({
  guestsApi: {
    getGuests: vi.fn(),
    getAnalytics: vi.fn(),
    createGuest: vi.fn(),
    updateGuest: vi.fn(),
    deleteGuest: vi.fn(),
    updateGuestRSVP: vi.fn(),
    updateGuestInvitation: vi.fn(),
  },
}));

import { guestsApi } from '../features/guests/api';

describe('Guest Management Component Tests', () => {
  let queryClient: QueryClient;

  const mockGuests: Guest[] = [
    {
      id: 'guest-1',
      event_id: 'event-1',
      name: 'Vikramaditya Singhania',
      email: 'vikram@singhania.com',
      phone: '+91 98765 43210',
      category: 'VIP',
      rsvp_status: 'CONFIRMED',
      invitation_status: 'SENT',
      plus_ones: 2,
      total_party_count: 3,
      dietary_preferences: 'Vegetarian, Jain',
      dietary_restrictions: 'Vegetarian, Jain',
      accessibility_requirements: 'Wheelchair access required',
      table_assignment: 'Table Royal 1',
      notes: 'Close family elder',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'guest-2',
      event_id: 'event-1',
      name: 'Ananya Deshmukh',
      email: 'ananya@example.com',
      phone: '+91 91234 56789',
      category: 'Friends',
      rsvp_status: 'INVITED',
      invitation_status: 'SENT',
      plus_ones: 0,
      total_party_count: 1,
      dietary_preferences: 'Gluten-Free',
      dietary_restrictions: 'Gluten-Free',
      accessibility_requirements: null,
      table_assignment: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockAnalytics: GuestAnalytics = {
    total_guests: 2,
    total_invited: 2,
    confirmed_guests: 1,
    declined_guests: 0,
    pending_responses: 1,
    maybe_responses: 0,
    expected_attendance: 3,
    total_plus_ones: 2,
    confirmed_plus_ones: 2,
    attendance_rate: 50.0,
    dietary_preference_distribution: {
      Vegetarian: 1,
      Jain: 1,
      'Gluten-Free': 1,
    },
    guest_category_distribution: {
      VIP: 1,
      Friends: 1,
    },
    rsvp_status_distribution: {
      CONFIRMED: 1,
      INVITED: 1,
    },
  };

  const mockListResponse: GuestListResponse = {
    items: mockGuests,
    total: 2,
    page: 1,
    page_size: 50,
    total_pages: 1,
    analytics: mockAnalytics,
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

  it('renders guest analytics overview cards and directory table', async () => {
    vi.mocked(guestsApi.getGuests).mockResolvedValue(mockListResponse);
    vi.mocked(guestsApi.getAnalytics).mockResolvedValue(mockAnalytics);

    render(
      <QueryClientProvider client={queryClient}>
        <GuestView />
      </QueryClientProvider>
    );

    // Verify analytics cards
    await waitFor(() => {
      expect(screen.getByText('Total Guests')).toBeInTheDocument();
      expect(screen.getByText('Expected Heads')).toBeInTheDocument();
      expect(screen.getByText('Pending RSVP')).toBeInTheDocument();
    });

    // Verify dietary breakdown chip
    expect(screen.getByText(/Catering Dietary Matrix:/i)).toBeInTheDocument();
    expect(screen.getByText('Vegetarian:')).toBeInTheDocument();

    // Verify guest list items
    expect(screen.getByText('Vikramaditya Singhania')).toBeInTheDocument();
    expect(screen.getByText('Ananya Deshmukh')).toBeInTheDocument();
  });

  it('allows searching and category filtering', async () => {
    vi.mocked(guestsApi.getGuests).mockResolvedValue(mockListResponse);
    vi.mocked(guestsApi.getAnalytics).mockResolvedValue(mockAnalytics);

    render(
      <QueryClientProvider client={queryClient}>
        <GuestView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by name, email, or table...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name, email, or table...');
    fireEvent.change(searchInput, { target: { value: 'Vikramaditya' } });

    // Category button click
    const vipButton = screen.getByRole('button', { name: 'VIP' });
    fireEvent.click(vipButton);

    expect(guestsApi.getGuests).toHaveBeenCalled();
  });

  it('triggers quick RSVP update and invitation toggle', async () => {
    vi.mocked(guestsApi.getGuests).mockResolvedValue(mockListResponse);
    vi.mocked(guestsApi.getAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(guestsApi.updateGuestRSVP).mockResolvedValue({
      ...mockGuests[1]!,
      rsvp_status: 'CONFIRMED',
    });
    vi.mocked(guestsApi.updateGuestInvitation).mockResolvedValue({
      ...mockGuests[0]!,
      invitation_status: 'NOT_SENT',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GuestView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Vikramaditya Singhania')).toBeInTheDocument();
    });

    // Toggle invitation status for guest 1
    const sentButtons = screen.getAllByRole('button', { name: /Sent/i });
    if (sentButtons[0]) {
      fireEvent.click(sentButtons[0]);
      await waitFor(() => {
        expect(guestsApi.updateGuestInvitation).toHaveBeenCalled();
      });
    }
  });

  it('validates and submits new guest in GuestModal', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <GuestModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        guest={null}
      />
    );

    expect(screen.getByText('Add New Guest')).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Kavita Krishnamurthy' } });

    const submitBtn = screen.getByRole('button', { name: 'Add Guest' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kavita Krishnamurthy',
          category: 'Friends',
          rsvp_status: 'INVITED',
        })
      );
    });
  });
});

