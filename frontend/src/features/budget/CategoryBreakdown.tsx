import React from 'react';
import { BudgetCategory } from '@/types/budget';
import { Card, Button, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/currency';
import { Plus, Sparkles, Edit2, Trash2, FolderPlus, AlertCircle } from 'lucide-react';

interface CategoryBreakdownProps {
  categories: BudgetCategory[];
  currency?: string;
  onAddCategory: () => void;
  onEditCategory: (category: BudgetCategory) => void;
  onDeleteCategory: (category: BudgetCategory) => void;
  onSeedCategories: () => void;
  isSeeding?: boolean;
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  categories,
  currency = 'INR',
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onSeedCategories,
  isSeeding = false,
}) => {
  return (
    <Card className="border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>Category Allocations</span>
            <Badge variant="neutral" className="text-xs">
              {categories.length} Categories
            </Badge>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Budget distribution and spending utilization by department
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {categories.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSeedCategories}
              disabled={isSeeding}
              className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSeeding ? 'Seeding...' : 'Seed Standard Categories'}</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={onAddCategory}
            className="text-xs flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Category</span>
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <FolderPlus className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">No Budget Categories Yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Initialize standard event categories (Venue, Catering, Decor, etc.) or create your own custom buckets.
          </p>
          <div className="flex items-center justify-center space-x-3">
            <Button
              variant="primary"
              size="sm"
              onClick={onSeedCategories}
              disabled={isSeeding}
              className="text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Seed Standard Categories
            </Button>
            <Button variant="outline" size="sm" onClick={onAddCategory} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Custom Category
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const spent = cat.total_actual > 0 ? cat.total_actual : cat.total_estimated;
            const allocated = cat.allocated_amount;
            const utilization = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
            const isOverAllocated = spent > allocated && allocated > 0;

            let progressColor = 'bg-emerald-500';
            if (utilization >= 100) progressColor = 'bg-rose-500';
            else if (utilization >= 80) progressColor = 'bg-amber-500';

            return (
              <div
                key={cat.id}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{cat.name}</h4>
                      <span className="text-[11px] text-slate-500">
                        {cat.items?.length || 0} expense item{(cat.items?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onEditCategory(cat)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/60"
                        title="Edit category"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteCategory(cat)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Delete category"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 my-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Spent: {formatCurrency(spent, { currency })}</span>
                      <span className="font-semibold text-slate-800">
                        Cap: {formatCurrency(allocated, { currency })}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span
                        className={`font-semibold ${
                          isOverAllocated ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {utilization}% used
                      </span>
                      {isOverAllocated && (
                        <span className="text-[10px] text-rose-600 flex items-center space-x-0.5">
                          <AlertCircle className="w-3 h-3" />
                          <span>Over allocation</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Target Share: {cat.percentage_target}%</span>
                  <span>Paid: {formatCurrency(cat.total_paid, { currency })}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

