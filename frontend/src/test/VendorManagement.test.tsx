import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VendorView } from '../features/vendors/VendorView';
import { VendorModal } from '../features/vendors/VendorModal';
import { useEventStore } from '../stores/useEventStore';
import { VendorSummary, VendorCategory, VendorItem } from '../types/vendor';

// Mock vendor API
vi.mock('../features/vendors/api', () => ({
  vendorsApi: {
    getVendorSummary: vi.fn(),
    getCategories: vi.fn(),
    seedCategories: vi.fn(),
    createVendor: vi.fn(),
    updateVendor: vi.fn(),
    deleteVendor: vi.fn(),
  },
}));

import { vendorsApi } from '../features/vendors/api';

describe('Vendor Management Component Tests', () => {
  let queryClient: QueryClient;

  const mockCategories: VendorCategory[] = [
    { id: 'cat-1', name: 'Venue', description: 'Banquet & palace venues' },
    { id: 'cat-2', name: 'Catering', description: 'Food & drinks' },
    { id: 'cat-3', name: 'Photography', description: 'Photo & film' },
  ];

  const mockVendors: VendorItem[] = [
    {
      id: 'ven-1',
      event_id: 'event-1',
      category: 'Venue',
      name: 'Udaipur City Palace Grand Banquet',
      contact_name: 'Maharaj Man Singh',
      contact_email: 'palace@udaipur.com',
      contact_phone: '+91 98290 12345',
      location: 'Udaipur, Rajasthan',
      website: 'https://udaipurpalace.com',
      status: 'BOOKED',
      estimated_quote: 2000000,
      final_agreed_price: 1950000,
      advance_paid: 500000,
      quoted_amount: 2000000,
      agreed_cost: 1950000,
      remaining_payment: 1450000,
      contract_signed: true,
      notes: 'Includes lakeside courtyard and royal lighting setup',
      is_ai_suggested_checklist: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'ven-2',
      event_id: 'event-1',
      category: 'Photography',
      name: 'Heritage Frames Photography',
      contact_name: 'Aditi Sharma',
      contact_email: 'aditi@heritageframes.com',
      contact_phone: '+91 99887 76655',
      location: 'Mumbai / Udaipur',
      website: 'https://heritageframes.com',
      status: 'QUOTED',
      estimated_quote: 450000,
      final_agreed_price: null,
      advance_paid: 0,
      quoted_amount: 450000,
      agreed_cost: 0,
      remaining_payment: 0,
      contract_signed: false,
      notes: 'Includes 3-day cinematic drone coverage',
      is_ai_suggested_checklist: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockSummary: VendorSummary = {
    event_id: 'event-1',
    currency: 'INR',
    total_vendors: 2,
    booked_vendors: 1,
    hired_vendors: 1,
    pending_vendors: 1,
    total_quoted_amount: 2450000,
    total_agreed_cost: 1950000,
    total_advance_paid: 500000,
    total_remaining_payment: 1450000,
    total_contracted_spend: 1950000,
    items: mockVendors,
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

  it('renders vendor summary financial cards and vendor list', async () => {
    vi.mocked(vendorsApi.getVendorSummary).mockResolvedValue(mockSummary);
    vi.mocked(vendorsApi.getCategories).mockResolvedValue(mockCategories);

    render(
      <QueryClientProvider client={queryClient}>
        <VendorView />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText('Udaipur City Palace Grand Banquet')
    ).toBeInTheDocument();
    expect(screen.getByText('Heritage Frames Photography')).toBeInTheDocument();

    // Verify financial cards
    expect(screen.getByText('Total Agreed Cost')).toBeInTheDocument();
    expect(screen.getAllByText('Advance Paid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Remaining Balance Due')).toBeInTheDocument();
    expect(screen.getByText('Booked Partners')).toBeInTheDocument();
  });

  it('submits vendor creation modal with contact info and quotes', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <VendorModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={mockSubmit}
        categories={mockCategories}
        currency="INR"
      />
    );

    const nameInput = screen.getByPlaceholderText(/Royal Rajputana Feasts/i);
    fireEvent.change(nameInput, { target: { value: 'Marwar Sound & Light Productions' } });

    const contactInput = screen.getByPlaceholderText(/Chef Vikram Singh/i);
    fireEvent.change(contactInput, { target: { value: 'Sunil Sharma' } });

    const submitBtn = screen.getByRole('button', { name: /Add Vendor/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Marwar Sound & Light Productions',
          contact_name: 'Sunil Sharma',
          status: 'DISCOVERING',
        })
      );
    });
  });

  it('filters vendor directory by category pill click', async () => {
    vi.mocked(vendorsApi.getVendorSummary).mockResolvedValue(mockSummary);
    vi.mocked(vendorsApi.getCategories).mockResolvedValue(mockCategories);

    render(
      <QueryClientProvider client={queryClient}>
        <VendorView />
      </QueryClientProvider>
    );

    expect(
      await screen.findByText('Udaipur City Palace Grand Banquet')
    ).toBeInTheDocument();

    // Click on Photography category pill
    const photoPill = screen.getByRole('button', { name: 'Photography' });
    fireEvent.click(photoPill);

    await waitFor(() => {
      expect(vendorsApi.getVendorSummary).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({ category: 'Photography' })
      );
    });
  });

  it('prevents advance payment from exceeding agreed cost in modal', async () => {
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <VendorModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={mockSubmit}
        categories={mockCategories}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Royal Rajputana Feasts/i);
    fireEvent.change(nameInput, { target: { value: 'Test DJ' } });

    const agreedInput = screen.getByLabelText(/Agreed Price/i);
    fireEvent.change(agreedInput, { target: { value: '50000' } });

    const advanceInput = screen.getByLabelText(/Advance Deposit Paid/i);
    fireEvent.change(advanceInput, { target: { value: '75000' } }); // > 50000

    const submitBtn = screen.getByRole('button', { name: /Add Vendor/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(/Advance paid \(75000\) cannot exceed agreed or quoted cost \(50000\)/i)
    ).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
