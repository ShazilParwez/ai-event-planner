import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Users, Utensils, Accessibility, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Guest,
  GuestCreatePayload,
  GuestUpdatePayload,
  RSVPStatus,
  GuestCategory,
  InvitationStatus,
} from '@/types/guest';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GuestCreatePayload | GuestUpdatePayload) => Promise<void>;
  guest?: Guest | null;
  isLoading?: boolean;
}

const CATEGORIES: GuestCategory[] = [
  'Family',
  'Friends',
  'Colleagues',
  'VIP',
  'Community',
  'Other',
];

const RSVP_STATUSES: { value: RSVPStatus; label: string }[] = [
  { value: 'INVITED', label: 'Invited (Awaiting Response)' },
  { value: 'CONFIRMED', label: 'Confirmed (Attending)' },
  { value: 'DECLINED', label: 'Declined (Cannot Attend)' },
  { value: 'MAYBE', label: 'Maybe (Tentative)' },
  { value: 'WAITING', label: 'Waiting (On Waitlist)' },
];

export const GuestModal: React.FC<GuestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  guest,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<string>('Friends');
  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus>('INVITED');
  const [invitationStatus, setInvitationStatus] = useState<InvitationStatus>('NOT_SENT');
  const [plusOnes, setPlusOnes] = useState('0');
  const [dietaryPreferences, setDietaryPreferences] = useState('');
  const [accessibilityRequirements, setAccessibilityRequirements] = useState('');
  const [tableAssignment, setTableAssignment] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guest) {
      setName(guest.name || '');
      setEmail(guest.email || '');
      setPhone(guest.phone || '');
      setCategory(guest.category || 'Friends');
      setRsvpStatus(guest.rsvp_status || 'INVITED');
      setInvitationStatus(guest.invitation_status || 'NOT_SENT');
      setPlusOnes((guest.plus_ones ?? 0).toString());
      setDietaryPreferences(guest.dietary_preferences || guest.dietary_restrictions || '');
      setAccessibilityRequirements(guest.accessibility_requirements || '');
      setTableAssignment(guest.table_assignment || '');
      setNotes(guest.notes || '');
    } else {
      setName('');
      setEmail('');
      setPhone('');
      setCategory('Friends');
      setRsvpStatus('INVITED');
      setInvitationStatus('NOT_SENT');
      setPlusOnes('0');
      setDietaryPreferences('');
      setAccessibilityRequirements('');
      setTableAssignment('');
      setNotes('');
    }
    setError(null);
  }, [guest, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Guest name is required.');
      return;
    }

    const pOnes = parseInt(plusOnes, 10);
    if (isNaN(pOnes) || pOnes < 0) {
      setError('Plus ones count must be a non-negative number.');
      return;
    }

    try {
      setError(null);
      await onSubmit({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        category,
        rsvp_status: rsvpStatus,
        invitation_status: invitationStatus,
        plus_ones: pOnes,
        dietary_preferences: dietaryPreferences.trim() || null,
        accessibility_requirements: accessibilityRequirements.trim() || null,
        table_assignment: tableAssignment.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save guest record.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {guest ? 'Edit Guest Details' : 'Add New Guest'}
              </h3>
              <p className="text-xs text-gray-500">
                Manage contact info, RSVP state, dietary needs, and seating assignments.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Full Name & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="guest-name-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="guest-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vikramaditya Singhania"
                required
              />
            </div>

            <div>
              <label htmlFor="guest-category-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Guest Category
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <select
                  id="guest-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="guest-email-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="guest-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="guest-phone-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="guest-phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* RSVP Status & Invitation Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="guest-rsvp-select" className="block text-xs font-semibold text-gray-700 mb-1">
                RSVP Status
              </label>
              <select
                id="guest-rsvp-select"
                value={rsvpStatus}
                onChange={(e) => setRsvpStatus(e.target.value as RSVPStatus)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {RSVP_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="guest-invitation-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Invitation Status
              </label>
              <select
                id="guest-invitation-select"
                value={invitationStatus}
                onChange={(e) => setInvitationStatus(e.target.value as InvitationStatus)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="NOT_SENT">Not Sent (Draft)</option>
                <option value="SENT">Sent (Delivered)</option>
              </select>
            </div>
          </div>

          {/* Plus Ones & Table Assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="guest-plus-ones-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Plus-Ones Count
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="guest-plus-ones-input"
                  type="number"
                  min="0"
                  max="10"
                  value={plusOnes}
                  onChange={(e) => setPlusOnes(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Total party attending = 1 guest + {plusOnes || 0} plus-ones = {1 + (parseInt(plusOnes, 10) || 0)}
              </p>
            </div>

            <div>
              <label htmlFor="guest-table-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Table Assignment
              </label>
              <input
                id="guest-table-input"
                type="text"
                value={tableAssignment}
                onChange={(e) => setTableAssignment(e.target.value)}
                placeholder="e.g. Table 4 - Royal Courtyard"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dietary Preferences & Accessibility */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="guest-dietary-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Dietary Preferences & Allergies
              </label>
              <div className="relative">
                <Utensils className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="guest-dietary-input"
                  type="text"
                  value={dietaryPreferences}
                  onChange={(e) => setDietaryPreferences(e.target.value)}
                  placeholder="e.g. Vegetarian, Jain, Nut Allergy"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="guest-accessibility-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Accessibility Requirements
              </label>
              <div className="relative">
                <Accessibility className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="guest-accessibility-input"
                  type="text"
                  value={accessibilityRequirements}
                  onChange={(e) => setAccessibilityRequirements(e.target.value)}
                  placeholder="e.g. Wheelchair ramp, Step-free seating"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="guest-notes-input" className="block text-xs font-semibold text-gray-700 mb-1">
              Private Notes
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <textarea
                id="guest-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special welcome protocol, relation notes, etc."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : guest ? 'Update Guest' : 'Add Guest'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

