import React, { useState } from 'react';
import {
  Calendar,
  DollarSign,
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CopilotProposedAction } from '@/types/copilot';
import {
  useExecuteCopilotActionMutation,
  useDismissCopilotActionMutation,
} from './hooks';
import { formatCurrency } from '@/lib/currency';

interface CopilotActionCardProps {
  action: CopilotProposedAction;
  eventId: string;
  threadId: string;
  currency?: string;
}

export const CopilotActionCard: React.FC<CopilotActionCardProps> = ({
  action,
  eventId,
  threadId,
  currency = 'INR',
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeMutation = useExecuteCopilotActionMutation(eventId, threadId);
  const dismissMutation = useDismissCopilotActionMutation(eventId, threadId);

  const isPending = action.status === 'PENDING';
  const isExecuting =
    action.status === 'EXECUTING' || executeMutation.isPending;
  const isExecuted = action.status === 'EXECUTED';
  const isDismissed = action.status === 'DISMISSED';

  const handleApprove = async () => {
    setErrorMessage(null);
    try {
      await executeMutation.mutateAsync(action.action_id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to execute action. Please try again.');
      }
    }
  };

  const handleDismiss = async () => {
    setErrorMessage(null);
    try {
      await dismissMutation.mutateAsync(action.action_id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to dismiss action.');
      }
    }
  };

  // Type styling & badges
  const getTypeConfig = () => {
    switch (action.action_type) {
      case 'ADD_TIMELINE_MILESTONE':
        return {
          label: 'Timeline Milestone',
          icon: <Calendar className="w-4 h-4 text-blue-600" />,
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
          borderColor: 'border-blue-200',
        };
      case 'ADD_BUDGET_EXPENSE':
        return {
          label: 'Budget Expense',
          icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          borderColor: 'border-emerald-200',
        };
      case 'ADD_VENDOR_ITEM':
        return {
          label: 'Vendor Procurement',
          icon: <Store className="w-4 h-4 text-purple-600" />,
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
          borderColor: 'border-purple-200',
        };
      default:
        return {
          label: 'Event Action',
          icon: <ShieldCheck className="w-4 h-4 text-slate-600" />,
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
          borderColor: 'border-slate-200',
        };
    }
  };

  const config = getTypeConfig();
  const params = action.parameters || {};

  return (
    <div
      className={`mt-3 rounded-xl border bg-white p-3.5 shadow-sm transition-all ${
        isExecuted
          ? 'border-emerald-300 bg-emerald-50/20'
          : isDismissed
          ? 'border-slate-200 bg-slate-50 opacity-60'
          : config.borderColor
      }`}
    >
      {/* Header with Type Pill and Status */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.badgeBg}`}
        >
          {config.icon}
          <span>{config.label}</span>
        </span>

        {isExecuted && (
          <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Applied & Verified</span>
          </span>
        )}

        {isDismissed && (
          <span className="inline-flex items-center space-x-1 text-xs font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            <span>Dismissed</span>
          </span>
        )}

        {isExecuting && (
          <span className="inline-flex items-center space-x-1 text-xs font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Applying mutation...</span>
          </span>
        )}
      </div>

      {/* Action Title & Description */}
      <h4 className="text-sm font-bold text-slate-900 leading-snug">
        {action.title}
      </h4>
      {action.description && (
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
          {action.description}
        </p>
      )}

      {/* Structured Parameters Snapshot */}
      <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1 border border-slate-100 font-mono">
        {action.action_type === 'ADD_TIMELINE_MILESTONE' && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-500">Phase:</span>
              <span className="font-semibold text-slate-800">
                {String(params.phase || 'GENERAL')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Priority:</span>
              <span className="font-semibold text-slate-800">
                {String(params.priority || 'MEDIUM')}
              </span>
            </div>
            {(params.due_date || params.target_date) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-semibold text-slate-800">
                  {String(params.due_date || params.target_date)}
                </span>
              </div>
            )}
          </>
        )}

        {action.action_type === 'ADD_BUDGET_EXPENSE' && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-500">Category:</span>
              <span className="font-semibold text-slate-800">
                {String(params.category_name || params.category || 'General')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Estimated Cost:</span>
              <span className="font-semibold text-emerald-700">
                {formatCurrency(
                  Number(params.estimated_cost || params.cost || 0),
                  { currency }
                )}
              </span>
            </div>
            {params.status && (
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-slate-800">
                  {String(params.status)}
                </span>
              </div>
            )}
          </>
        )}

        {action.action_type === 'ADD_VENDOR_ITEM' && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-500">Category:</span>
              <span className="font-semibold text-slate-800">
                {String(params.category || 'Vendor')}
              </span>
            </div>
            {(params.estimated_quote || params.quoted_amount) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Quoted:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(
                    Number(params.estimated_quote || params.quoted_amount || 0),
                    { currency }
                  )}
                </span>
              </div>
            )}
            {(params.final_agreed_price || params.agreed_cost) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Agreed Price:</span>
                <span className="font-semibold text-purple-700">
                  {formatCurrency(
                    Number(params.final_agreed_price || params.agreed_cost || 0),
                    { currency }
                  )}
                </span>
              </div>
            )}
            {params.vendor_id && (
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>Vendor Ref:</span>
                <span className="truncate max-w-[150px]">
                  {String(params.vendor_id)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Error alert if execution or dismissal fails */}
      {errorMessage && (
        <div className="mt-2.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start space-x-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      {/* Controls for PENDING status */}
      {isPending && (
        <div className="mt-3 flex items-center justify-end space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={isExecuting || dismissMutation.isPending}
            className="text-slate-500 hover:text-slate-700 text-xs h-7 px-2.5"
          >
            Dismiss
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApprove}
            disabled={isExecuting || executeMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3 flex items-center space-x-1.5"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <span>Approve & Apply</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
