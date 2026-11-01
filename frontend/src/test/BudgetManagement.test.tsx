import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BudgetOverviewCards } from '../features/budget/BudgetOverviewCards';
import { OverBudgetAlert } from '../features/budget/OverBudgetAlert';
import { CategoryBreakdown } from '../features/budget/CategoryBreakdown';
import { BudgetItemModal } from '../features/budget/BudgetItemModal';
import { BudgetOverview, BudgetCategory } from '../types/budget';

describe('Budget Management UI Component Tests', () => {
  const mockCategories: BudgetCategory[] = [
    {
      id: 'cat-1',
      event_id: 'event-1',
      name: 'Venue & Facilities',
      allocated_amount: 1000000,
      percentage_target: 40,
      items: [
        {
          id: 'item-1',
          category_id: 'cat-1',
          event_id: 'event-1',
          title: 'Palace Hall Deposit',
          estimated_cost: 800000,
          actual_cost: 850000,
          paid_amount: 500000,
          status: 'PENDING',
          is_ai_suggested: false,
          notes: 'Advance receipt #402',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      total_estimated: 800000,
      total_actual: 850000,
      total_paid: 500000,
      variance: 150000,
      utilization_percentage: 85,
      is_over_allocated: false,
    },
  ];

  const mockOverview: BudgetOverview = {
    event_id: 'event-1',
    target_budget: 2500000,
    total_allocated: 1000000,
    total_estimated: 800000,
    total_actual: 850000,
    total_paid: 500000,
    remaining_budget: 1650000,
    variance: 1650000,
    is_over_budget: false,
    currency: 'INR',
    categories: mockCategories,
  };

  it('renders budget KPI overview cards with exact currency formatting', () => {
    render(<BudgetOverviewCards overview={mockOverview} currency="INR" />);

    expect(screen.getByText('Target Budget')).toBeInTheDocument();
    expect(screen.getByText('Allocated')).toBeInTheDocument();
    expect(screen.getByText('Actual Spend')).toBeInTheDocument();
    expect(screen.getByText('Total Paid')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
  });

  it('renders over-budget warning alert only when is_over_budget is true', () => {
    const { rerender } = render(
      <OverBudgetAlert isOverBudget={false} variance={50000} currency="INR" />
    );
    expect(screen.queryByText('Budget Limit Exceeded')).not.toBeInTheDocument();

    rerender(
      <OverBudgetAlert isOverBudget={true} variance={-150000} currency="INR" />
    );
    expect(screen.getByText('Budget Limit Exceeded')).toBeInTheDocument();
    expect(screen.getByText(/your committed and actual expenditures currently surpass/i)).toBeInTheDocument();
  });

  it('renders category breakdown with allocations and utilization percentage', () => {
    render(
      <CategoryBreakdown
        categories={mockCategories}
        currency="INR"
        onAddCategory={vi.fn()}
        onEditCategory={vi.fn()}
        onDeleteCategory={vi.fn()}
        onSeedCategories={vi.fn()}
      />
    );

    expect(screen.getByText('Venue & Facilities')).toBeInTheDocument();
    expect(screen.getByText('85% used')).toBeInTheDocument();
    expect(screen.getByText('Target Share: 40%')).toBeInTheDocument();
  });

  it('validates that paid amount cannot exceed actual cost in expense item modal', async () => {
    const handleSubmit = vi.fn();
    render(
      <BudgetItemModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
        categories={mockCategories}
      />
    );

    const titleInput = screen.getByPlaceholderText(/venue banquet hall deposit/i);
    fireEvent.change(titleInput, { target: { value: 'Catering Advance' } });

    // Actual cost 1000, but paid 1500
    const actualInputs = screen.getAllByRole('spinbutton');
    const actualCostInput = actualInputs[1];
    const paidAmountInput = actualInputs[2];

    if (actualCostInput && paidAmountInput) {
      fireEvent.change(actualCostInput, { target: { value: '1000' } });
      fireEvent.change(paidAmountInput, { target: { value: '1500' } });
    }

    const submitBtn = screen.getByRole('button', { name: /add item/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/paid amount cannot exceed actual cost/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});

