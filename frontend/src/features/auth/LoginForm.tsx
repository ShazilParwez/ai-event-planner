import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onSuccess }) => {
  const { login, isLoading, authError, clearAuthError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();

    if (!validate()) return;

    try {
      await login({ email: email.trim(), password });
      if (onSuccess) onSuccess();
    } catch {
      // Error handled in store and displayed via authError
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
        <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-1">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <Input
            id="login-email"
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
        <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-1">
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <Input
            id="login-password"
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
            placeholder="Enter your password"
            disabled={isLoading}
            className={`pl-10 pr-10 ${clientErrors.password ? 'border-rose-400 focus:ring-rose-500' : ''}`}
            autoComplete="current-password"
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
            <span>Signing in...</span>
          </>
        ) : (
          <span>Sign In</span>
        )}
      </Button>

      <div className="text-center pt-2">
        <p className="text-xs text-slate-600">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline focus:outline-none"
          >
            Create an account
          </button>
        </p>
      </div>
    </form>
  );
};
