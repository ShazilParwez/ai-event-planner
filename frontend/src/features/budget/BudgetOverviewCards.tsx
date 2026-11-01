import React from 'react';
import { BudgetOverview } from '@/types/budget';
import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/currency';
import { DollarSign, PieChart, TrendingUp, CheckCircle, AlertCircle, Wallet } from 'lucide-react';

interface BudgetOverviewCardsProps {
  overview: BudgetOverview;
  currency?: string;
}

export const BudgetOverviewCards: React.FC<BudgetOverviewCardsProps> = ({
  overview,
  currency = 'INR',
}) => {
  const isOver = overview.is_over_budget;
  const curr = overview.currency || currency;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Target Budget */}
      <Card className="p-4 border-slate-200">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Target Budget</span>
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
          {formatCurrency(overview.target_budget, { currency: curr })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Total cap target</p>
      </Card>

      {/* Allocated Amount */}
      <Card className="p-4 border-slate-200">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Allocated</span>
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
            <PieChart className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-base sm:text-lg font-bold text-indigo-900 truncate">
          {formatCurrency(overview.total_allocated, { currency: curr })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Across categories</p>
      </Card>

      {/* Total Estimated */}
      <Card className="p-4 border-slate-200">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Estimated</span>
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-base sm:text-lg font-bold text-amber-900 truncate">
          {formatCurrency(overview.total_estimated, { currency: curr })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Initial quotes sum</p>
      </Card>

      {/* Actual Spend */}
      <Card className="p-4 border-slate-200">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Actual Spend</span>
          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
          {formatCurrency(overview.total_actual, { currency: curr })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Incurred commitments</p>
      </Card>

      {/* Total Paid */}
      <Card className="p-4 border-slate-200">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider">Total Paid</span>
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-base sm:text-lg font-bold text-emerald-800 truncate">
          {formatCurrency(overview.total_paid, { currency: curr })}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Cash disbursed</p>
      </Card>

      {/* Remaining Budget */}
      <Card
        className={`p-4 border ${
          isOver
            ? 'border-rose-300 bg-rose-50/40'
            : 'border-emerald-300 bg-emerald-50/40'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            {isOver ? 'Deficit' : 'Remaining'}
          </span>
          <div
            className={`p-1.5 rounded-md ${
              isOver ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isOver ? <AlertCircle className="w-3.5 h-3.5" /> : <DollarSign className="w-3.5 h-3.5" />}
          </div>
        </div>
        <div
          className={`text-base sm:text-lg font-extrabold truncate ${
            isOver ? 'text-rose-700' : 'text-emerald-700'
          }`}
        >
          {formatCurrency(overview.remaining_budget, { currency: curr })}
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          {isOver ? 'Over budget limit' : 'Under budget limit'}
        </p>
      </Card>
    </div>
  );
};

