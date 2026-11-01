import React, { useState } from 'react';
import {
  Store,
  Plus,
  Filter,
  Search,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  Globe,
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Edit2,
  Sparkles,
  Briefcase,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useEventStore } from '@/stores/useEventStore';
import { formatCurrency } from '@/lib/currency';
import {
  useVendorSummaryQuery,
  useVendorCategoriesQuery,
  useSeedVendorCategoriesMutation,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeleteVendorMutation,
} from './hooks';
import { VendorModal } from './VendorModal';
import {
  VendorItem,
  VendorStatus,
  VendorItemCreateInput,
  VendorItemUpdateInput,
} from '@/types/vendor';

interface VendorViewProps {
  onNavigateToEvents?: () => void;
}

export const VendorView: React.FC<VendorViewProps> = ({ onNavigateToEvents }) => {
  const activeEvent = useEventStore((state) => state.activeEvent);

  const { data: categories = [] } = useVendorCategoriesQuery();
  const seedCategoriesMutation = useSeedVendorCategoriesMutation();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: summary, isLoading, error } = useVendorSummaryQuery(
    activeEvent?.id || null,
    {
      category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    }
  );

  const createVendorMutation = useCreateVendorMutation(activeEvent?.id || '');
  const updateVendorMutation = useUpdateVendorMutation(activeEvent?.id || '');
  const deleteVendorMutation = useDeleteVendorMutation(activeEvent?.id || '');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);

  if (!activeEvent) {
    return (
      <Card className="p-8 text-center max-w-xl mx-auto my-12 border-dashed border-slate-300">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
          <Store className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Event Selected</h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto mb-6">
          Please select an event from the Event Hub or create a new event to manage vendor directories, quotes, and advance contracts.
        </p>
        <Button variant="primary" onClick={onNavigateToEvents} className="mx-auto">
          Go to Events Hub
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-slate-500">Loading vendor management directory...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-200 text-rose-800">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h4 className="font-bold">Failed to load vendor directory</h4>
        <p className="text-xs mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const items = summary?.items || [];
  const currency = activeEvent.currency || 'INR';

  // Client-side text search
  const filteredVendors = items.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.contact_name && v.contact_name.toLowerCase().includes(q)) ||
      (v.notes && v.notes.toLowerCase().includes(q)) ||
      v.category.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: VendorStatus) => {
    switch (status) {
      case 'BOOKED':
      case 'HIRED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            BOOKED
          </span>
        );
      case 'NEGOTIATING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            NEGOTIATING
          </span>
        );
      case 'QUOTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            QUOTED
          </span>
        );
      case 'CONTACTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            CONTACTED
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            DISCOVERING
          </span>
        );
    }
  };

  const handleStatusChange = async (vendorId: string, newStatus: VendorStatus) => {
    await updateVendorMutation.mutateAsync({
      vendorId,
      data: { status: newStatus },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
            <Store className="w-3.5 h-3.5" />
            <span>Vendor Pipeline & Contracts</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeEvent.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Partner quotations, agreed contract budgets, deposit schedules, and execution status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {categories.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedCategoriesMutation.mutate()}
              disabled={seedCategoriesMutation.isPending}
              className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              {seedCategoriesMutation.isPending ? 'Seeding...' : 'Seed Vendor Categories'}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingVendor(null);
              setIsModalOpen(true);
            }}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Partner Vendor
          </Button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Agreed Cost */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Agreed Cost
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {formatCurrency(Number(summary?.total_agreed_cost || 0), { currency })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total quoted: {formatCurrency(Number(summary?.total_quoted_amount || 0), { currency })}
          </p>
        </Card>

        {/* Advance Deposits Paid */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Advance Paid
            </span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600">
            {formatCurrency(Number(summary?.total_advance_paid || 0), { currency })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Confirmed supplier deposit payments
          </p>
        </Card>

        {/* Remaining Payment Balance */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Remaining Balance Due
            </span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">
            {formatCurrency(Number(summary?.total_remaining_payment || 0), { currency })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            To be settled upon service delivery
          </p>
        </Card>

        {/* Vendor Roster Counts */}
        <Card className="p-5 border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Booked Partners
            </span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700">
            {summary?.booked_vendors || 0}{' '}
            <span className="text-sm font-semibold text-slate-400">
              / {summary?.total_vendors || 0}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary?.pending_vendors || 0} vendors in negotiation / discovery
          </p>
        </Card>
      </div>

      {/* Directory & Filters Area */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/40">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors by name, contact, notes..."
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="BOOKED">Booked Only</option>
              <option value="NEGOTIATING">Negotiating</option>
              <option value="QUOTED">Quotation Received</option>
              <option value="CONTACTED">Contacted</option>
              <option value="DISCOVERING">Discovering</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Category Pills Navigation */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-none bg-white">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Vendor Cards Grid */}
        <div className="p-4 sm:p-6">
          {filteredVendors.length === 0 ? (
            <div className="py-12 text-center max-w-sm mx-auto">
              <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-800">No Vendors Found</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Add partner suppliers or adjust category and status filters.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingVendor(null);
                  setIsModalOpen(true);
                }}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Your First Vendor
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 mb-1">
                          {vendor.category}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                          {vendor.name}
                        </h4>
                      </div>
                      {getStatusBadge(vendor.status)}
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {vendor.contact_name && (
                        <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{vendor.contact_name}</span>
                        </div>
                      )}
                      {vendor.contact_phone && (
                        <div className="flex items-center space-x-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`tel:${vendor.contact_phone}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {vendor.contact_phone}
                          </a>
                        </div>
                      )}
                      {vendor.contact_email && (
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a
                            href={`mailto:${vendor.contact_email}`}
                            className="text-emerald-700 hover:underline truncate"
                          >
                            {vendor.contact_email}
                          </a>
                        </div>
                      )}
                      {vendor.location && (
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{vendor.location}</span>
                        </div>
                      )}
                      {vendor.website && (
                        <div className="flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <a
                            href={vendor.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline truncate"
                          >
                            {vendor.website.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Financial Summary Box */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Agreed Cost
                        </span>
                        <span className="font-bold text-slate-900">
                          {vendor.final_agreed_price !== null
                            ? formatCurrency(Number(vendor.final_agreed_price), { currency })
                            : vendor.estimated_quote !== null
                            ? formatCurrency(Number(vendor.estimated_quote), { currency })
                            : 'Pending'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                          Advance Paid
                        </span>
                        <span className="font-bold text-blue-600">
                          {formatCurrency(Number(vendor.advance_paid || 0), { currency })}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          Balance Due:
                        </span>
                        <span className="font-bold text-amber-600">
                          {formatCurrency(Number(vendor.remaining_payment || 0), { currency })}
                        </span>
                      </div>
                    </div>

                    {vendor.contract_signed && (
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700">
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Contract Signed & Verified</span>
                      </div>
                    )}

                    {vendor.notes && (
                      <p className="text-[11px] text-slate-500 bg-slate-50/50 p-2 rounded-lg line-clamp-2">
                        {vendor.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3">
                    <select
                      value={vendor.status}
                      onChange={(e) => handleStatusChange(vendor.id, e.target.value as VendorStatus)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="DISCOVERING">Discovering</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUOTED">Quoted</option>
                      <option value="NEGOTIATING">Negotiating</option>
                      <option value="BOOKED">Booked</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setEditingVendor(vendor);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit vendor"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingVendorId(vendor.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete vendor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vendor Modal */}
      <VendorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        vendor={editingVendor}
        categories={categories}
        currency={currency}
        onSubmit={async (data) => {
          if (editingVendor) {
            await updateVendorMutation.mutateAsync({
              vendorId: editingVendor.id,
              data: data as VendorItemUpdateInput,
            });
          } else {
            await createVendorMutation.mutateAsync(data as VendorItemCreateInput);
          }
        }}
        isLoading={createVendorMutation.isPending || updateVendorMutation.isPending}
      />

      {/* Delete Vendor Confirmation Modal */}
      {deletingVendorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Delete Partner Vendor?</h4>
            <p className="text-xs text-slate-500">
              Remove this vendor from the event directory and contract pipeline?
            </p>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingVendorId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await deleteVendorMutation.mutateAsync(deletingVendorId);
                  setDeletingVendorId(null);
                }}
                disabled={deleteVendorMutation.isPending}
              >
                {deleteVendorMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
