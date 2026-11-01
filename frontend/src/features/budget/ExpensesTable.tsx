import React, { useState } from 'react';
import { BudgetItem, BudgetCategory, BudgetItemStatus } from '@/types/budget';
import { Card, Button, Badge, Input } from '@/components/ui';
import { formatCurrency } from '@/lib/currency';
import { Plus, Search, Edit2, Trash2, Receipt, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface ExpensesTableProps {
  categories: BudgetCategory[];
  currency?: string;
  onAddItem: () => void;
  onEditItem: (item: BudgetItem) => void;
  onDeleteItem: (item: BudgetItem) => void;
}

export const ExpensesTable: React.FC<ExpensesTableProps> = ({
  categories,
  currency = 'INR',
  onAddItem,
  onEditItem,
  onDeleteItem,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Flatten all items with category name lookup
  const allItems: (BudgetItem & { categoryName: string })[] = [];
  categories.forEach((cat) => {
    (cat.items || []).forEach((item) => {
      allItems.push({ ...item, categoryName: cat.name });
    });
  });

  const filteredItems = allItems.filter((item) => {
    const matchesSearch =
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'ALL' || item.category_id === selectedCategory;

    const matchesStatus =
      statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: BudgetItemStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="success" className="flex items-center space-x-1">
            <CheckCircle className="w-3 h-3" />
            <span>Paid</span>
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="warning" className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" className="flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            <span>Estimated</span>
          </Badge>
        );
    }
  };

  return (
    <Card className="border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>Expense Ledger</span>
            <Badge variant="neutral" className="text-xs">
              {allItems.length} Line Items
            </Badge>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Granular expense records, payment status, and vendor quotes
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onAddItem}
          disabled={categories.length === 0}
          className="text-xs flex items-center space-x-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Expense Item</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items or notes..."
            className="pl-9 text-xs"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ESTIMATED">Estimated</option>
            <option value="PENDING">Pending Payment</option>
            <option value="PAID">Paid in Full</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredItems.length === 0 ? (
        <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">No Expenses Recorded</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {categories.length === 0
              ? 'Add or seed a category first to begin logging expense items.'
              : 'Add your first line item quote, deposit, or invoice.'}
          </p>
          {categories.length > 0 && (
            <Button variant="primary" size="sm" onClick={onAddItem} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Expense
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Item & Details</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Estimated</th>
                <th className="py-3 px-3 text-right">Actual</th>
                <th className="py-3 px-3 text-right">Paid</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    {item.notes && (
                      <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                        {item.notes}
                      </div>
                    )}
                    {item.is_ai_suggested && (
                      <span className="inline-block mt-0.5 text-[9px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        AI Recommended
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-medium">
                      {item.categoryName}
                    </span>
                  </td>
                  <td className="py-3 px-3">{getStatusBadge(item.status)}</td>
                  <td className="py-3 px-3 text-right font-medium text-slate-700">
                    {formatCurrency(item.estimated_cost, { currency })}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-900">
                    {formatCurrency(item.actual_cost, { currency })}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                    {formatCurrency(item.paid_amount, { currency })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => onEditItem(item)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                        title="Edit item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

