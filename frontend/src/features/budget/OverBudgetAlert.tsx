import React from 'react';
import { formatCurrency } from '@/lib/currency';
import { AlertTriangle, TrendingDown } from 'lucide-react';

interface OverBudgetAlertProps {
  isOverBudget: boolean;
  variance: number;
  currency?: string;
}

export const OverBudgetAlert: React.FC<OverBudgetAlertProps> = ({
  isOverBudget,
  variance,
  currency = 'INR',
}) => {
  if (!isOverBudget) return null;

  const overspendAmount = Math.abs(variance);

  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 shadow-sm animate-in fade-in duration-200">
      <div className="flex items-start space-x-3.5">
        <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h4 className="text-sm font-bold text-rose-900 flex items-center space-x-1.5">
              <span>Budget Limit Exceeded</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-200 text-rose-800">
                <TrendingDown className="w-3 h-3 mr-1" />
                Deficit: {formatCurrency(overspendAmount, { currency })}
              </span>
            </h4>
          </div>
          <p className="text-xs text-rose-700 mt-1 leading-relaxed">
            Your committed and actual expenditures currently surpass the target event budget by{' '}
            <strong>{formatCurrency(overspendAmount, { currency })}</strong>.
            Review high-variance categories below to reallocate funds or adjust targets.
          </p>
        </div>
      </div>
    </div>
  );
};

