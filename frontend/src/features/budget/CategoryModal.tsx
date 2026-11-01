import React, { useState, useEffect } from 'react';
import { BudgetCategory, BudgetCategoryCreateInput } from '@/types/budget';
import { Button, Input } from '@/components/ui';
import { X, FolderPlus } from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetCategoryCreateInput) => Promise<void>;
  initialData?: BudgetCategory | null;
  currency?: string;
  isLoading?: boolean;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  currency = 'INR',
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [allocatedAmount, setAllocatedAmount] = useState<number>(0);
  const [percentageTarget, setPercentageTarget] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAllocatedAmount(initialData.allocated_amount);
      setPercentageTarget(initialData.percentage_target);
    } else {
      setName('');
      setAllocatedAmount(0);
      setPercentageTarget(0);
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Category name is required.';
    }

    if (allocatedAmount < 0) {
      newErrors.allocatedAmount = 'Allocated amount cannot be negative.';
    }

    if (percentageTarget < 0 || percentageTarget > 100) {
      newErrors.percentageTarget = 'Target percentage must be between 0 and 100.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        name: name.trim(),
        allocated_amount: Number(allocatedAmount),
        percentage_target: Number(percentageTarget),
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/40 to-teal-50/20">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {initialData ? 'Edit Budget Category' : 'Add Budget Category'}
              </h3>
              <p className="text-xs text-slate-500">
                Allocate funds and define percentage target
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.form && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
              {errors.form}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Category Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Venue & Logistics, Catering, Photography"
              error={errors.name}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Allocated ({currency})</label>
              <Input
                type="number"
                min="0"
                step="100"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(Number(e.target.value))}
                error={errors.allocatedAmount}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Target Share (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={percentageTarget}
                onChange={(e) => setPercentageTarget(Number(e.target.value))}
                error={errors.percentageTarget}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : initialData ? 'Update Category' : 'Create Category'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

