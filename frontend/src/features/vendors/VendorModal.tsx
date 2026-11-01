import React, { useState, useEffect } from 'react';
import { X, Store, DollarSign, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  VendorItem,
  VendorCategory,
  VendorItemCreateInput,
  VendorItemUpdateInput,
  VendorStatus,
} from '@/types/vendor';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VendorItemCreateInput | VendorItemUpdateInput) => Promise<void>;
  vendor?: VendorItem | null | undefined;
  categories: VendorCategory[];
  currency?: string;
  isLoading?: boolean;
}

const DEFAULT_CATEGORIES = [
  'Venue',
  'Catering',
  'Decoration',
  'Photography',
  'Videography',
  'Entertainment',
  'Transportation',
  'Accommodation',
  'Makeup and Styling',
  'Printing and Invitations',
  'Other',
];

export const VendorModal: React.FC<VendorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  vendor,
  categories,
  currency = 'INR',
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Venue');
  const [status, setStatus] = useState<VendorStatus>('DISCOVERING');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [estimatedQuote, setEstimatedQuote] = useState('');
  const [finalAgreedPrice, setFinalAgreedPrice] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');
  const [contractSigned, setContractSigned] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setCategory(vendor.category || 'Venue');
      setStatus(vendor.status || 'DISCOVERING');
      setContactName(vendor.contact_name || '');
      setContactPhone(vendor.contact_phone || '');
      setContactEmail(vendor.contact_email || '');
      setLocation(vendor.location || '');
      setWebsite(vendor.website || '');
      setEstimatedQuote(vendor.estimated_quote !== null ? String(vendor.estimated_quote) : '');
      setFinalAgreedPrice(vendor.final_agreed_price !== null ? String(vendor.final_agreed_price) : '');
      setAdvancePaid(vendor.advance_paid !== undefined ? String(vendor.advance_paid) : '0');
      setContractSigned(vendor.contract_signed || false);
      setNotes(vendor.notes || '');
    } else {
      setName('');
      setCategory(categories[0]?.name || 'Venue');
      setStatus('DISCOVERING');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setLocation('');
      setWebsite('');
      setEstimatedQuote('');
      setFinalAgreedPrice('');
      setAdvancePaid('0');
      setContractSigned(false);
      setNotes('');
    }
    setFormError(null);
  }, [vendor, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !category) return;

    const quoteNum = estimatedQuote ? parseFloat(estimatedQuote) : null;
    const agreedNum = finalAgreedPrice ? parseFloat(finalAgreedPrice) : null;
    const advanceNum = advancePaid ? parseFloat(advancePaid) : 0;

    const ceiling = agreedNum !== null ? agreedNum : quoteNum;
    if (ceiling !== null && advanceNum > ceiling) {
      setFormError(`Advance paid (${advanceNum}) cannot exceed agreed or quoted cost (${ceiling}).`);
      return;
    }

    await onSubmit({
      name: name.trim(),
      category,
      status,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim() || null,
      contact_email: contactEmail.trim() || null,
      location: location.trim() || null,
      website: website.trim() || null,
      estimated_quote: quoteNum,
      final_agreed_price: agreedNum,
      advance_paid: advanceNum,
      contract_signed: contractSigned,
      notes: notes.trim() || null,
    });
    onClose();
  };

  const categoryOptions = categories.length > 0
    ? categories.map((c) => c.name)
    : DEFAULT_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {vendor ? 'Edit Vendor Details' : 'Add Partner Vendor'}
              </h3>
              <p className="text-xs text-slate-500">
                Manage vendor quotations, advance deposits, contact info, and booking pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {formError && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {formError}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Vendor / Business Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Royal Rajputana Feasts & Catering"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Vendor Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Booking Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VendorStatus)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="DISCOVERING">Discovering / Researching</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUOTED">Quotation Received</option>
                <option value="NEGOTIATING">Negotiating</option>
                <option value="BOOKED">Booked / Hired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Financials Section */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>Financial Quotation & Contract ({currency})</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Estimated Quote ({currency})
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedQuote}
                  onChange={(e) => {
                    setEstimatedQuote(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="agreed-price-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Agreed Price ({currency})
                </label>
                <Input
                  id="agreed-price-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalAgreedPrice}
                  onChange={(e) => {
                    setFinalAgreedPrice(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label htmlFor="advance-paid-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Advance Deposit Paid
                </label>
                <Input
                  id="advance-paid-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={advancePaid}
                  onChange={(e) => {
                    setAdvancePaid(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>

            <label className="flex items-center space-x-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={contractSigned}
                onChange={(e) => setContractSigned(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs font-medium text-slate-700 flex items-center space-x-1">
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Formal contract signed & stamped</span>
              </span>
            </label>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Person
              </label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g., Chef Vikram Singh"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@vendor.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Location / City
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Udaipur / Jaipur"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Portfolio / Website URL
            </label>
            <Input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://vendorwebsite.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Negotiation Notes & Scope of Work
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Deliverables included, staff counts, cancellation policy, deposit schedule..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Saving...' : vendor ? 'Update Vendor' : 'Add Vendor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
