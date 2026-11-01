import React, { useState, useEffect } from 'react';
import { BudgetItem, BudgetItemCreateInput, BudgetItemStatus, BudgetCategory } from '@/types/budget';
import { Button, Input } from '@/components/ui';
import { X, DollarSign, Receipt, Tag } from 'lucide-react';

interface BudgetItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetItemCreateInput) => Promise<void>;
  categories: BudgetCategory[];
  initialData?: BudgetItem | null;
  defaultCategoryId?: string;
  currency?: string;
  isLoading?: boolean;
}

export const BudgetItemModal: React.FC<BudgetItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialData,
  defaultCategoryId,
  currency = 'INR',
  isLoading = false,
}) => {
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<BudgetItemStatus>('ESTIMATED');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [actualCost, setActualCost] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setCategoryId(initialData.category_id);
      setTitle(initialData.title);
      setStatus(initialData.status);
      setEstimatedCost(initialData.estimated_cost);
      setActualCost(initialData.actual_cost);
      setPaidAmount(initialData.paid_amount);
      setNotes(initialData.notes || '');
    } else {
      setCategoryId(defaultCategoryId || (categories[0]?.id ?? ''));
      setTitle('');
      setStatus('ESTIMATED');
      setEstimatedCost(0);
      setActualCost(0);
      setPaidAmount(0);
      setNotes('');
    }
    setErrors({});
  }, [initialData, defaultCategoryId, categories, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Item title is required.';
    }

    if (!categoryId) {
      newErrors.categoryId = 'Please select a budget category.';
    }

    if (estimatedCost < 0) {
      newErrors.estimatedCost = 'Estimated cost cannot be negative.';
    }

    if (actualCost < 0) {
      newErrors.actualCost = 'Actual cost cannot be negative.';
    }

    if (paidAmount < 0) {
      newErrors.paidAmount = 'Paid amount cannot be negative.';
    }

    if (actualCost > 0 && paidAmount > actualCost) {
      newErrors.paidAmount = 'Paid amount cannot exceed actual cost.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        category_id: categoryId,
        title: title.trim(),
        status,
        estimated_cost: Number(estimatedCost),
        actual_cost: Number(actualCost),
        paid_amount: Number(paidAmount),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrors((prev) => ({ ...prev, form: err.message }));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/40 to-teal-50/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {initialData ? 'Edit Expense Item' : 'Add Expense Item'}
              </h3>
              <p className="text-xs text-slate-500">
                Track estimated costs and payments deterministically
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.form && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {errors.form}
            </div>
          )}

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Category *</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="" disabled>Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-xs text-rose-600 mt-1">{errors.categoryId}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Payment Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BudgetItemStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ESTIMATED">Estimated</option>
                <option value="PENDING">Pending Payment</option>
                <option value="PAID">Paid in Full</option>
              </select>
            </div>
          </div>

          {/* Item Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Expense Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Venue Banquet Hall Deposit, Wedding Cake, DJ Setup"
              error={errors.title}
              required
            />
          </div>

          {/* Financials: Estimated, Actual, Paid */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Amounts ({currency})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Estimated Cost</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(Number(e.target.value))}
                  error={errors.estimatedCost}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Actual Cost</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={actualCost}
                  onChange={(e) => setActualCost(Number(e.target.value))}
                  error={errors.actualCost}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Paid Amount</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  error={errors.paidAmount}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Notes / Vendor Remarks</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 50% advance paid on contract signing"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : initialData ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

