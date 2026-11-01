import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { changePassword, isLoading, authError, clearAuthError } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clientErrors, setClientErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  if (!isOpen) return null;

  const validate = () => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long';
    } else if (newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirmation password is required';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    if (!validate()) return;

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      // Reset form and close
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setClientErrors({});
      onClose();
    } catch {
      // Error is stored in authError
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Lock className="w-5 h-5" />
            </div>
            <h2 id="change-password-title" className="text-lg font-bold text-slate-900">
              Change Password
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {authError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1 font-medium">{authError}</div>
            </div>
          )}

          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Current Password *
            </label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (clientErrors.currentPassword) {
                    setClientErrors((prev) => {
                      const { currentPassword: _, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
                placeholder="Enter current password"
                disabled={isLoading}
                className={`pr-10 ${
                  clientErrors.currentPassword ? 'border-rose-400 focus:ring-rose-500' : ''
                }`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {clientErrors.currentPassword && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {clientErrors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1">
              New Password *
            </label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (clientErrors.newPassword) {
                    setClientErrors((prev) => {
                      const { newPassword: _, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
                placeholder="Minimum 8 characters"
                disabled={isLoading}
                className={`pr-10 ${
                  clientErrors.newPassword ? 'border-rose-400 focus:ring-rose-500' : ''
                }`}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {clientErrors.newPassword && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-new-password"
              className="block text-sm font-semibold text-slate-700 mb-1"
            >
              Confirm New Password *
            </label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (clientErrors.confirmPassword) {
                    setClientErrors((prev) => {
                      const { confirmPassword: _, ...rest } = prev;
                      return rest;
                    });
                  }
                }}
                placeholder="Re-enter new password"
                disabled={isLoading}
                className={`pr-10 ${
                  clientErrors.confirmPassword ? 'border-rose-400 focus:ring-rose-500' : ''
                }`}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {clientErrors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-600 font-medium">
                {clientErrors.confirmPassword}
              </p>
            )}
          </div>

          <div className="pt-3 flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
