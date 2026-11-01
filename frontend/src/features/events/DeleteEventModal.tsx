import React from 'react';
import { Event } from '@/types/event';
import { Button } from '@/components/ui';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  event: Event | null;
  isLoading?: boolean;
}

export const DeleteEventModal: React.FC<DeleteEventModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  event,
  isLoading = false,
}) => {
  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Event?</h3>
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-900 font-semibold">{event.title || event.name}</strong>?
            This will cascade and delete all associated budget categories, expense items, and records. This action cannot be undone.
          </p>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              disabled={isLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isLoading ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

