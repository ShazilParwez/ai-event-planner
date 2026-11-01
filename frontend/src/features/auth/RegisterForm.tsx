import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onSuccess?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin, onSuccess }) => {
  const { register, isLoading, authError, clearAuthError } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const isPasswordLongEnough = password.length >= 8;
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);

  const validate = () => {
    const errors: { email?: string; password?: string; confirmPassword?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirmation password is required';
    } else if (password !== confirmPassword) {
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
      await register({
        email: email.trim(),
        password,
        ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
      });
      if (onSuccess) onSuccess();
    } catch {
      // Error handled in store
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
        <label htmlFor="register-name" className="block text-sm font-semibold text-slate-700 mb-1">
          Full Name <span className="text-xs text-slate-400 font-normal">(Optional)</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <UserIcon className="w-4 h-4" />
          </div>
          <Input
            id="register-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Maya Sharma"
            disabled={isLoading}
            className="pl-10"
            autoComplete="name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="register-email" className="block text-sm font-semibold text-slate-700 mb-1">
          Email Address *
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <Input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (clientErrors.email) {
                setClientErrors((prev) => {
                  const { email: _, ...rest } = prev;
                  return rest;
                });
              }
            }}
            placeholder="planner@example.com"
            disabled={isLoading}
            className={`pl-10 ${clientErrors.email ? 'border-rose-400 focus:ring-rose-500' : ''}`}
            autoComplete="email"
            required
          />
        </div>
        {clientErrors.email && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.email}</p>
        )}
      </div>

      <div>
        <label htmlFor="register-password" className="block text-sm font-semibold text-slate-700 mb-1">
          Password *
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <Input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (clientErrors.password) {
                setClientErrors((prev) => {
                  const { password: _, ...rest } = prev;
                  return rest;
                });
              }
            }}
            placeholder="At least 8 characters"
            disabled={isLoading}
            className={`pl-10 pr-10 ${clientErrors.password ? 'border-rose-400 focus:ring-rose-500' : ''}`}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {clientErrors.password && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.password}</p>
        )}

        {/* Password Strength Guidelines */}
        <div className="mt-2 flex items-center space-x-3 text-xs">
          <div
            className={`flex items-center space-x-1 ${
              isPasswordLongEnough ? 'text-emerald-600 font-medium' : 'text-slate-400'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>8+ characters</span>
          </div>
          <div
            className={`flex items-center space-x-1 ${
              hasNumberOrSymbol ? 'text-emerald-600 font-medium' : 'text-slate-400'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Number/symbol recommended</span>
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor="register-confirm-password"
          className="block text-sm font-semibold text-slate-700 mb-1"
        >
          Confirm Password *
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <Input
            id="register-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
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
            placeholder="Re-enter your password"
            disabled={isLoading}
            className={`pl-10 pr-10 ${
              clientErrors.confirmPassword ? 'border-rose-400 focus:ring-rose-500' : ''
            }`}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {clientErrors.confirmPassword && (
          <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.confirmPassword}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        className="w-full flex items-center justify-center space-x-2 py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Creating account...</span>
          </>
        ) : (
          <span>Create Account</span>
        )}
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-slate-600">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline focus:outline-none"
          >
            Sign in
          </button>
        </p>
      </div>
    </form>
  );
};
