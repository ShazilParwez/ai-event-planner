import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EventFormModal } from '../features/events/EventFormModal';
import { DeleteEventModal } from '../features/events/DeleteEventModal';
import { Event } from '../types/event';

describe('Event Management UI Component Tests', () => {
  const mockEvent: Event = {
    id: 'test-event-uuid-1',
    title: "Ananya & Kabir's Wedding",
    event_type: 'WEDDING',
    description: 'Heritage royal wedding in Jaipur palace',
    location: 'Jaipur, Rajasthan',
    start_date: '2026-11-20T10:00:00Z',
    end_date: '2026-11-22T22:00:00Z',
    expected_guest_count: 300,
    target_budget: 4000000,
    currency: 'INR',
    status: 'PLANNING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('renders event create modal with required input fields', () => {
    render(
      <EventFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText('Create New Event')).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Maya & Aryan's Royal Wedding")).toBeInTheDocument();
    expect(screen.getByText('Total Target Budget *')).toBeInTheDocument();
    expect(screen.getByText('Currency (ISO 4217) *')).toBeInTheDocument();
  });

  it('validates minimum event title length and displays validation error', async () => {
    const handleSubmit = vi.fn();
    render(
      <EventFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText("e.g. Maya & Aryan's Royal Wedding");
    fireEvent.change(titleInput, { target: { value: 'A' } });

    const submitBtn = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/event title must be at least 2 characters long/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates 3-letter uppercase currency code', async () => {
    const handleSubmit = vi.fn();
    render(
      <EventFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    const titleInput = screen.getByPlaceholderText("e.g. Maya & Aryan's Royal Wedding");
    fireEvent.change(titleInput, { target: { value: 'Valid Event Title' } });

    const currencyInput = screen.getByPlaceholderText('INR');
    fireEvent.change(currencyInput, { target: { value: 'IN' } }); // only 2 chars

    const submitBtn = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/currency must be a 3-letter iso code/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('populates initial data when editing an existing event', () => {
    render(
      <EventFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initialData={mockEvent}
      />
    );

    expect(screen.getByText('Edit Event Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ananya & Kabir's Wedding")).toBeInTheDocument();
    expect(screen.getByDisplayValue('4000000')).toBeInTheDocument();
  });

  it('renders delete confirmation modal with event title and cascade warning', () => {
    const handleConfirm = vi.fn();
    render(
      <DeleteEventModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
        event={mockEvent}
      />
    );

    expect(screen.getByText('Delete Event?')).toBeInTheDocument();
    expect(screen.getByText("Ananya & Kabir's Wedding")).toBeInTheDocument();
    expect(screen.getByText(/cascade and delete all associated budget categories/i)).toBeInTheDocument();
  });
});

