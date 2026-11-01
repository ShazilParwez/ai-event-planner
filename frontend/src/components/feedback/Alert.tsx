import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
}

export const Alert: React.FC<AlertProps> = ({ type = 'info', title, message }) => {
  const styles = {
    info: { bg: 'bg-blue-50 border-blue-200 text-blue-800', icon: Info, iconColor: 'text-blue-500' },
    success: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: CheckCircle2, iconColor: 'text-emerald-500' },
    warning: { bg: 'bg-amber-50 border-amber-200 text-amber-800', icon: AlertCircle, iconColor: 'text-amber-500' },
    error: { bg: 'bg-rose-50 border-rose-200 text-rose-800', icon: XCircle, iconColor: 'text-rose-500' },
  }[type];

  const Icon = styles.icon;

  return (
    <div className={`p-4 rounded-xl border flex items-start space-x-3 ${styles.bg}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${styles.iconColor}`} />
      <div className="text-sm">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <p>{message}</p>
      </div>
    </div>
  );
};

