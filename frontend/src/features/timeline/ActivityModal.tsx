import React, { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  TimelineActivity,
  TimelineMilestone,
  ActivityCreateInput,
  ActivityUpdateInput,
} from '@/types/timeline';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ActivityCreateInput | ActivityUpdateInput) => Promise<void>;
  activity?: TimelineActivity | null | undefined;
  milestones: TimelineMilestone[];
  isLoading?: boolean;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  activity,
  milestones,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [milestoneId, setMilestoneId] = useState<string>('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [responsibleParty, setResponsibleParty] = useState('');
  const [status, setStatus] = useState('SCHEDULED');
  const [description, setDescription] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    if (activity) {
      setTitle(activity.title);
      setMilestoneId(activity.milestone_id || '');
      setStartTime(new Date(activity.start_time).toISOString().slice(0, 16));
      setEndTime(
        activity.end_time ? new Date(activity.end_time).toISOString().slice(0, 16) : ''
      );
      setLocation(activity.location || '');
      setResponsibleParty(activity.responsible_party || '');
      setStatus(activity.status || 'SCHEDULED');
      setDescription(activity.description || '');
    } else {
      setTitle('');
      setMilestoneId(milestones.length > 0 ? milestones[0]?.id || '' : '');
      const defaultStart = new Date();
      defaultStart.setHours(defaultStart.getHours() + 1, 0, 0, 0);
      setStartTime(defaultStart.toISOString().slice(0, 16));
      const defaultEnd = new Date(defaultStart);
      defaultEnd.setHours(defaultEnd.getHours() + 1);
      setEndTime(defaultEnd.toISOString().slice(0, 16));
      setLocation('');
      setResponsibleParty('');
      setStatus('SCHEDULED');
      setDescription('');
    }
    setTimeError(null);
  }, [activity, milestones, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime) return;

    if (endTime && new Date(endTime) < new Date(startTime)) {
      setTimeError('End time cannot be earlier than start time.');
      return;
    }

    await onSubmit({
      title: title.trim(),
      milestone_id: milestoneId || null,
      start_time: new Date(startTime).toISOString(),
      end_time: endTime ? new Date(endTime).toISOString() : null,
      location: location.trim() || null,
      responsible_party: responsibleParty.trim() || null,
      status,
      description: description.trim() || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {activity ? 'Edit Day-Of Activity' : 'Schedule Itinerary Activity'}
              </h3>
              <p className="text-xs text-slate-500">
                Minute-by-minute execution schedule for wedding or event day
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Activity Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Royal Baraat Procession & Welcome Ceremony"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Associated Milestone (Optional)
            </label>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="">General Event Schedule</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.phase})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setTimeError(null);
                }}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                End Time
              </label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setTimeError(null);
                }}
              />
            </div>
          </div>

          {timeError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              {timeError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Location / Venue Area
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Palace Courtyard"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Responsible Party / Lead
              </label>
              <Input
                value={responsibleParty}
                onChange={(e) => setResponsibleParty(e.target.value)}
                placeholder="e.g., Band Lead / Event Coordinator"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Execution Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes & Special Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Sound cues, prop placements, VIP escort requirements..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || !title.trim()}>
              {isLoading ? 'Saving...' : activity ? 'Update Activity' : 'Schedule Activity'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
