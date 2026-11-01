import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  TimelineMilestone,
  MilestoneCreateInput,
  MilestoneUpdateInput,
  MilestoneStatus,
  MilestonePriority,
} from '@/types/timeline';

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MilestoneCreateInput | MilestoneUpdateInput) => Promise<void>;
  milestone?: TimelineMilestone | null | undefined;
  isLoading?: boolean;
}

const PHASES = [
  { label: '6+ Months Before', value: '6_MONTHS_BEFORE' },
  { label: '3-5 Months Before', value: '4_MONTHS_BEFORE' },
  { label: '1-2 Months Before', value: '2_MONTHS_BEFORE' },
  { label: 'Final Month', value: '1_MONTH_BEFORE' },
  { label: 'Week of Event', value: '1_WEEK_BEFORE' },
  { label: 'Event Day', value: 'DAY_OF' },
  { label: 'Post Event', value: 'POST_EVENT' },
];

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  milestone,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState('PLANNING');
  const [priority, setPriority] = useState<MilestonePriority>('MEDIUM');
  const [status, setStatus] = useState<MilestoneStatus>('PENDING');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (milestone) {
      setTitle(milestone.title);
      setPhase(milestone.phase || 'PLANNING');
      setPriority(milestone.priority || 'MEDIUM');
      setStatus(milestone.status || 'PENDING');
      setDescription(milestone.description || '');
      if (milestone.target_date || milestone.due_date) {
        const dt = new Date(milestone.target_date || milestone.due_date!);
        setDueDate(dt.toISOString().slice(0, 16));
      } else {
        setDueDate('');
      }
    } else {
      setTitle('');
      setPhase('4_MONTHS_BEFORE');
      setPriority('MEDIUM');
      setStatus('PENDING');
      setDescription('');
      setDueDate('');
    }
  }, [milestone, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const formattedDate = dueDate ? new Date(dueDate).toISOString() : null;

    await onSubmit({
      title: title.trim(),
      phase,
      priority,
      status,
      target_date: formattedDate,
      due_date: formattedDate,
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
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {milestone ? 'Edit Planning Milestone' : 'Add Planning Milestone'}
              </h3>
              <p className="text-xs text-slate-500">
                Set milestones, priorities, and deadlines on your event roadmap
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
              Milestone Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Finalize Palace Catering Contract"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Planning Phase
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                {PHASES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as MilestonePriority)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Due Date
              </label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description / Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Key deliverables, required deposits, contacts, or requirements..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading || !title.trim()}>
              {isLoading ? 'Saving...' : milestone ? 'Update Milestone' : 'Create Milestone'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
