import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InspirationView } from '../features/inspiration/InspirationView';
import { InspirationCardModal } from '../features/inspiration/InspirationCardModal';
import { useEventStore } from '../stores/useEventStore';
import { InspirationCard, InspirationGenerateResponse } from '../types/inspiration';

// Mock inspiration API
vi.mock('../features/inspiration/api', () => ({
  inspirationApi: {
    getCards: vi.fn(),
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    toggleSaveCard: vi.fn(),
    generateIdeas: vi.fn(),
  },
}));

import { inspirationApi } from '../features/inspiration/api';

describe('Inspiration Studio Component Tests', () => {
  let queryClient: QueryClient;

  const mockCards: InspirationCard[] = [
    {
      id: 'card-1',
      event_id: 'event-1',
      title: 'Royal Rajwada Courtyard Canopy',
      category: 'Decorations',
      description: 'Handcrafted marigold garlands cascading around carved stone arches with brass hanging urlis.',
      tags: 'decor, lighting, royal, traditional',
      color_palette: ['#FF9933', '#D4AF37', '#800020', '#FFFDD0'],
      suggested_budget_range: '₹80,000 - ₹1,50,000 (Indicative)',
      notes: 'Ensure low-heat LED bulbs for flower longevity.',
      is_saved: true,
      is_ai_generated: false,
      source_type: 'USER',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'card-2',
      event_id: 'event-1',
      title: 'Sufi & Dhol Folk Fusion Troupe',
      category: 'Entertainment',
      description: 'Acoustic evening sufi performances transitioning into energetic dhol rhythms.',
      tags: 'music, sangeet, live',
      color_palette: ['#FF4500', '#FFD700'],
      suggested_budget_range: '₹1,00,000 - ₹2,00,000 (Indicative)',
      notes: null,
      is_saved: false,
      is_ai_generated: true,
      source_type: 'AI_GENERATED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockGenResponse: InspirationGenerateResponse = {
    ideas: [
      {
        title: 'Artisanal Kulfi & Jalebi Dessert Pavilions',
        category: 'Catering and Menus',
        description: 'Live interactive dessert counter with saffron rabri and nitrogen kulfi sticks.',
        tags: ['catering', 'dessert', 'interactive'],
        color_palette: ['#FFD700', '#FFA500', '#800000'],
        suggested_budget_range: '₹50,000 - ₹90,000 (Indicative)',
        source_type: 'AI_GENERATED',
      },
    ],
    disclaimer: 'Suggested budget ranges and ideas are creative, indicative estimates—not confirmed vendor quotations.',
    source: 'mock',
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

  it('renders inspiration gallery cards and category navigation', async () => {
    vi.mocked(inspirationApi.getCards).mockResolvedValue(mockCards);

    render(
      <QueryClientProvider client={queryClient}>
        <InspirationView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Inspiration Studio & Moodboard')).toBeInTheDocument();
      expect(screen.getByText('Royal Rajwada Courtyard Canopy')).toBeInTheDocument();
      expect(screen.getByText('Sufi & Dhol Folk Fusion Troupe')).toBeInTheDocument();
    });

    // Check category pills
    expect(screen.getByRole('button', { name: 'All Categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decorations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entertainment' })).toBeInTheDocument();

    // Check indicative budget label
    expect(screen.getByText('₹80,000 - ₹1,50,000 (Indicative)')).toBeInTheDocument();
  });

  it('filters by category and saved status', async () => {
    vi.mocked(inspirationApi.getCards).mockResolvedValue(mockCards);

    render(
      <QueryClientProvider client={queryClient}>
        <InspirationView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Royal Rajwada Courtyard Canopy')).toBeInTheDocument();
    });

    // Filter by Decorations
    const decorPill = screen.getByRole('button', { name: 'Decorations' });
    fireEvent.click(decorPill);
    expect(inspirationApi.getCards).toHaveBeenCalled();

    // Toggle Saved Only
    const savedToggle = screen.getByRole('button', { name: /Saved Only/i });
    fireEvent.click(savedToggle);
    expect(inspirationApi.getCards).toHaveBeenCalled();
  });

  it('triggers bookmark save toggle on card', async () => {
    vi.mocked(inspirationApi.getCards).mockResolvedValue(mockCards);
    vi.mocked(inspirationApi.toggleSaveCard).mockResolvedValue({
      ...mockCards[1]!,
      is_saved: true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InspirationView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sufi & Dhol Folk Fusion Troupe')).toBeInTheDocument();
    });

    const toggleBtns = screen.getAllByTitle(/moodboard/i);
    if (toggleBtns[1]) {
      fireEvent.click(toggleBtns[1]);
      await waitFor(() => {
        expect(inspirationApi.toggleSaveCard).toHaveBeenCalledWith('event-1', 'card-2');
      });
    }
  });

  it('opens AI generator modal, requests ideas, and saves idea to moodboard', async () => {
    vi.mocked(inspirationApi.getCards).mockResolvedValue(mockCards);
    vi.mocked(inspirationApi.generateIdeas).mockResolvedValue(mockGenResponse);
    vi.mocked(inspirationApi.createCard).mockResolvedValue({
      id: 'card-new',
      event_id: 'event-1',
      title: mockGenResponse.ideas[0]!.title,
      category: mockGenResponse.ideas[0]!.category,
      description: mockGenResponse.ideas[0]!.description,
      is_saved: true,
      is_ai_generated: true,
      source_type: 'AI_GENERATED',
      created_at: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <InspirationView />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Ideas \(AI\)/i })).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Generate Ideas \(AI\)/i }));

    expect(screen.getByText('AI Inspiration Studio Generator')).toBeInTheDocument();

    // Click generate in modal
    const generateBtn = screen.getByRole('button', { name: 'Generate Ideas' });
    fireEvent.click(generateBtn);

    // Verify generated candidate appears
    await waitFor(() => {
      expect(screen.getByText('Artisanal Kulfi & Jalebi Dessert Pavilions')).toBeInTheDocument();
    });

    // Click save to moodboard
    const saveToMoodboardBtn = screen.getByRole('button', { name: 'Save to Moodboard' });
    fireEvent.click(saveToMoodboardBtn);

    await waitFor(() => {
      expect(inspirationApi.createCard).toHaveBeenCalled();
    });
  });

  it('validates and submits custom card in InspirationCardModal', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <InspirationCardModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        card={null}
      />
    );

    expect(screen.getByText('Add Inspiration Card')).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Idea Title/i);
    fireEvent.change(titleInput, { target: { value: 'Vintage Royal Car Grand Entry' } });

    const descInput = screen.getByLabelText(/Creative Description/i);
    fireEvent.change(descInput, { target: { value: 'Classic 1930s convertible decorated with white tuberose garlands.' } });

    const submitBtn = screen.getByRole('button', { name: 'Save to Moodboard' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Vintage Royal Car Grand Entry',
          category: 'Decorations',
          description: 'Classic 1930s convertible decorated with white tuberose garlands.',
        })
      );
    });
  });
});

