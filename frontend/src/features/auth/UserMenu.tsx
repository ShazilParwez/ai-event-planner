import React, { useState, useRef, useEffect } from 'react';
import { LogOut, KeyRound, Shield, ShieldCheck, ChevronDown, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { ChangePasswordModal } from './ChangePasswordModal';
import { Button } from '@/components/ui/Button';

export const UserMenu: React.FC = () => {
  const { user, logout, isLoading } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [logoutAllDevices, setLogoutAllDevices] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const getInitials = (name?: string | null, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      const firstInitial = parts[0]?.[0];
      const secondInitial = parts[1]?.[0];
      if (firstInitial && secondInitial) {
        return `${firstInitial}${secondInitial}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : 'U';
  };

  const handleConfirmLogout = async () => {
    await logout(logoutAllDevices);
    setIsLogoutConfirmOpen(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile menu"
        className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
          {getInitials(user.full_name, user.email)}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
            {user.full_name || user.email.split('@')[0]}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            {user.is_superuser ? 'Administrator' : 'Planner'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2"
        >
          {/* User Details Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {user.full_name || 'Event Planner'}
              </span>
              {user.is_superuser ? (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                  Admin
                </span>
              ) : (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                  <Shield className="w-3 h-3 mr-0.5" />
                  User
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setIsPasswordModalOpen(true);
              }}
              className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-slate-400" />
              <span>Change Password</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setIsLogoutConfirmOpen(true);
              }}
              className="w-full flex items-center space-x-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Sign Out...</span>
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 id="logout-confirm-title" className="text-base font-bold text-slate-900">
                Confirm Sign Out
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to end your active session? Any unsaved edits will be discarded.
            </p>

            <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <input
                id="logout-all"
                type="checkbox"
                checked={logoutAllDevices}
                onChange={(e) => setLogoutAllDevices(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <label htmlFor="logout-all" className="text-xs font-medium text-slate-700 cursor-pointer">
                Sign out from all devices & active tabs
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLogoutConfirmOpen(false)}
                disabled={isLoading}
                className="border-slate-300 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmLogout}
                disabled={isLoading}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
