import React, { useState } from 'react';
import { Calendar, Sparkles, ShieldCheck, DollarSign, Users } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Branding */}
        <div className="flex justify-center items-center space-x-3 mb-2">
          <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-md shadow-emerald-200">
            <Calendar className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          AI Event Planner
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500 max-w-sm mx-auto">
          Intelligent Multi-Event Planning & AI Copilot Suite for Weddings, Birthdays & Celebrations
        </p>

        {/* Feature Pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5 px-4">
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
            <DollarSign className="w-3 h-3" />
            <span>Budget Intelligence</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800">
            <Sparkles className="w-3 h-3" />
            <span>AI Copilot</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-100 text-sky-800">
            <Users className="w-3 h-3" />
            <span>Guest & Vendor Hub</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
            <ShieldCheck className="w-3 h-3" />
            <span>Secure & Isolated</span>
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-100">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 mb-6 bg-slate-100 rounded-xl" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          {mode === 'login' ? (
            <LoginForm onSwitchToRegister={() => setMode('register')} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setMode('login')} />
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center space-x-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Protected with Argon2id hashing & JWT access tokens</span>
        </div>
      </div>
    </div>
  );
};
