import React, { useState, useEffect } from 'react';
import { Event, EventCreateInput, EventType, EventStatus } from '@/types/event';
import { Button, Input } from '@/components/ui';
import { X, Calendar, DollarSign, Users, MapPin, Sparkles } from 'lucide-react';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventCreateInput) => Promise<void>;
  initialData?: Event | null;
  isLoading?: boolean;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('WEDDING');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expectedGuestCount, setExpectedGuestCount] = useState<number>(50);
  const [targetBudget, setTargetBudget] = useState<number>(500000);
  const [currency, setCurrency] = useState('INR');
  const [status, setStatus] = useState<EventStatus>('PLANNING');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || initialData.name || '');
      setEventType(initialData.event_type);
      setDescription(initialData.description || initialData.notes || '');
      setLocation(initialData.location || '');
      setStartDate(initialData.start_date ? initialData.start_date.slice(0, 16) : '');
      setEndDate(initialData.end_date ? initialData.end_date.slice(0, 16) : '');
      setExpectedGuestCount(initialData.expected_guest_count || 0);
      setTargetBudget(initialData.target_budget || 0);
      setCurrency(initialData.currency || 'INR');
      setStatus(initialData.status || 'PLANNING');
    } else {
      setTitle('');
      setEventType('WEDDING');
      setDescription('');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setExpectedGuestCount(50);
      setTargetBudget(500000);
      setCurrency('INR');
      setStatus('PLANNING');
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim() || title.trim().length < 2) {
      newErrors.title = 'Event title must be at least 2 characters long.';
    }

    if (targetBudget < 0) {
      newErrors.targetBudget = 'Total budget cannot be negative.';
    }

    if (expectedGuestCount < 0) {
      newErrors.expectedGuestCount = 'Guest count cannot be negative.';
    }

    if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) {
      newErrors.currency = 'Currency must be a 3-letter ISO code (e.g. INR, USD).';
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      newErrors.endDate = 'End date cannot be earlier than start date.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        title: title.trim(),
        event_type: eventType,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined,
        expected_guest_count: Number(expectedGuestCount),
        target_budget: Number(targetBudget),
        currency: currency.trim().toUpperCase(),
        status,
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {initialData ? 'Edit Event Details' : 'Create New Event'}
              </h3>
              <p className="text-xs text-slate-500">
                {initialData ? 'Update event parameters and budget' : 'Initialize a fresh planning blueprint'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
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

          {/* Title & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700">Event Title / Name *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Maya & Aryan's Royal Wedding"
                error={errors.title}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Event Type *</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="WEDDING">Wedding</option>
                <option value="BIRTHDAY">Birthday</option>
                <option value="COMMUNITY">Community Event</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline the vision, key requirements, or event objectives..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
            />
          </div>

          {/* Location & Guest Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Location</span>
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Udaipur, Rajasthan or Grand Hyatt"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Expected Guests</span>
              </label>
              <Input
                type="number"
                min="0"
                value={expectedGuestCount}
                onChange={(e) => setExpectedGuestCount(Number(e.target.value))}
                error={errors.expectedGuestCount}
              />
            </div>
          </div>

          {/* Financials: Total Budget & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Total Target Budget *</span>
              </label>
              <Input
                type="number"
                min="0"
                step="100"
                value={targetBudget}
                onChange={(e) => setTargetBudget(Number(e.target.value))}
                error={errors.targetBudget}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Currency (ISO 4217) *</label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="INR"
                maxLength={3}
                error={errors.currency}
                required
              />
            </div>
          </div>

          {/* Dates: Start & End */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Start Date & Time</span>
              </label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>End Date & Time</span>
              </label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                error={errors.endDate}
              />
            </div>
          </div>

          {/* Status (if editing) */}
          {initialData && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Event Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="PLANNING">Planning</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : initialData ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

