import React, { useState } from 'react';
import { useEventStore } from '@/stores/useEventStore';
import { useEventsQuery } from '@/features/events/hooks';
import {
  useBudgetOverviewQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useSeedCategoriesMutation,
  useCreateBudgetItemMutation,
  useUpdateBudgetItemMutation,
  useDeleteBudgetItemMutation,
} from './hooks';
import {
  BudgetCategory,
  BudgetCategoryCreateInput,
  BudgetItem,
  BudgetItemCreateInput,
} from '@/types/budget';
import { BudgetOverviewCards } from './BudgetOverviewCards';
import { OverBudgetAlert } from './OverBudgetAlert';
import { CategoryBreakdown } from './CategoryBreakdown';
import { ExpensesTable } from './ExpensesTable';
import { CategoryModal } from './CategoryModal';
import { BudgetItemModal } from './BudgetItemModal';
import { Button } from '@/components/ui';
import {
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  X,
} from 'lucide-react';

interface BudgetViewProps {
  onNavigateToEvents?: () => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ onNavigateToEvents }) => {
  const { activeEventId, activeEvent, setActiveEvent } = useEventStore();
  const { data: allEvents = [] } = useEventsQuery();

  // Modal states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<BudgetCategory | null>(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<BudgetItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const effectiveEventId = activeEventId || allEvents[0]?.id || null;

  const {
    data: overview,
    isLoading,
    error,
  } = useBudgetOverviewQuery(effectiveEventId);

  // Mutations
  const createCategoryMutation = useCreateCategoryMutation(effectiveEventId || '');
  const updateCategoryMutation = useUpdateCategoryMutation(effectiveEventId || '');
  const deleteCategoryMutation = useDeleteCategoryMutation(effectiveEventId || '');
  const seedCategoriesMutation = useSeedCategoriesMutation(effectiveEventId || '');

  const createItemMutation = useCreateBudgetItemMutation(effectiveEventId || '');
  const updateItemMutation = useUpdateBudgetItemMutation(effectiveEventId || '');
  const deleteItemMutation = useDeleteBudgetItemMutation(effectiveEventId || '');

  // Category handlers
  const handleCategorySubmit = async (data: BudgetCategoryCreateInput) => {
    setActionError(null);
    try {
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({
          categoryId: editingCategory.id,
          data,
        });
      } else {
        await createCategoryMutation.mutateAsync(data);
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    }
  };

  const handleDeleteCategoryConfirm = async (force: boolean = false) => {
    if (!deletingCategory) return;
    setActionError(null);
    try {
      await deleteCategoryMutation.mutateAsync({
        categoryId: deletingCategory.id,
        force,
      });
      setDeletingCategory(null);
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    }
  };

  // Item handlers
  const handleItemSubmit = async (data: BudgetItemCreateInput) => {
    setActionError(null);
    try {
      if (editingItem) {
        await updateItemMutation.mutateAsync({
          itemId: editingItem.id,
          data,
        });
      } else {
        await createItemMutation.mutateAsync(data);
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    }
  };

  const handleDeleteItemConfirm = async () => {
    if (!deletingItem) return;
    setActionError(null);
    try {
      await deleteItemMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    } catch (err: unknown) {
      if (err instanceof Error) setActionError(err.message);
    }
  };

  if (!effectiveEventId && allEvents.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-xl mx-auto my-8">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
          <CalendarDays className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">No Active Event Selected</h3>
        <p className="text-sm text-slate-500 mb-6">
          You need an event to manage budgets, category allocations, and expenses. Create an event in the Event Hub to begin.
        </p>
        <Button variant="primary" onClick={onNavigateToEvents}>
          <span>Go to Event Hub</span>
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>
    );
  }

  const currentEvent =
    allEvents.find((e) => e.id === effectiveEventId) || activeEvent;

  const currency = overview?.currency || currentEvent?.currency || 'INR';

  return (
    <div className="space-y-6">
      {/* Event Selection & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-emerald-700">
              Budget Intelligence
            </span>
            <span>•</span>
            <span>{currentEvent?.event_type || 'Event'}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {currentEvent?.title || currentEvent?.name || 'Event Budget'}
          </h2>
        </div>

        {/* Event Selector Dropdown */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-semibold text-slate-600 hidden md:block">
            Switch Event:
          </label>
          <select
            value={effectiveEventId || ''}
            onChange={(e) => {
              const selected = allEvents.find((ev) => ev.id === e.target.value);
              if (selected) setActiveEvent(selected);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
          >
            {allEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title || ev.name} ({ev.currency || 'INR'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="p-1 text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          Failed to load budget overview: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Overview content */}
      {!isLoading && overview && (
        <>
          {/* Over-budget Warning Alert */}
          <OverBudgetAlert
            isOverBudget={overview.is_over_budget}
            variance={overview.variance}
            currency={currency}
          />

          {/* Metric KPI Rollup Cards */}
          <BudgetOverviewCards overview={overview} currency={currency} />

          {/* Category Allocations Breakdown */}
          <CategoryBreakdown
            categories={overview.categories || []}
            currency={currency}
            onAddCategory={() => {
              setEditingCategory(null);
              setIsCategoryModalOpen(true);
            }}
            onEditCategory={(cat) => {
              setEditingCategory(cat);
              setIsCategoryModalOpen(true);
            }}
            onDeleteCategory={(cat) => setDeletingCategory(cat)}
            onSeedCategories={() => seedCategoriesMutation.mutate()}
            isSeeding={seedCategoriesMutation.isPending}
          />

          {/* Granular Expenses Table */}
          <ExpensesTable
            categories={overview.categories || []}
            currency={currency}
            onAddItem={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsItemModalOpen(true);
            }}
            onDeleteItem={(item) => setDeletingItem(item)}
          />
        </>
      )}

      {/* Category Modal (Create / Edit) */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={handleCategorySubmit}
        initialData={editingCategory}
        currency={currency}
        isLoading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
      />

      {/* BudgetItem Modal (Create / Edit) */}
      <BudgetItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleItemSubmit}
        categories={overview?.categories || []}
        initialData={editingItem}
        currency={currency}
        isLoading={createItemMutation.isPending || updateItemMutation.isPending}
      />

      {/* Category Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setDeletingCategory(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Category?</h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to delete category{' '}
                <strong className="text-slate-900 font-semibold">{deletingCategory.name}</strong>?
                {deletingCategory.items?.length > 0 && (
                  <span className="block mt-2 text-rose-600 font-medium">
                    Warning: This category contains {deletingCategory.items.length} line items. Deleting it will also remove all associated expense records.
                  </span>
                )}
              </p>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setDeletingCategory(null)}
                  disabled={deleteCategoryMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDeleteCategoryConfirm(true)}
                  disabled={deleteCategoryMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {deleteCategoryMutation.isPending ? 'Deleting...' : 'Delete Category'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setDeletingItem(null)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Expense Item?</h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900 font-semibold">{deletingItem.title}</strong>?
                This transaction record will be removed from your ledger.
              </p>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setDeletingItem(null)}
                  disabled={deleteItemMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteItemConfirm}
                  disabled={deleteItemMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {deleteItemMutation.isPending ? 'Deleting...' : 'Delete Item'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
