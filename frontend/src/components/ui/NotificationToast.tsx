import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useNotificationStore, NotificationType } from '@/stores/useNotificationStore';

const typeStyles: Record<
  NotificationType,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
  },
  error: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-900',
    icon: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
  },
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-900',
    icon: <Info className="w-5 h-5 text-sky-600 flex-shrink-0" />,
  },
};

export const NotificationToast: React.FC = () => {
  const { notifications, dismissNotification } = useNotificationStore();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none"
    >
      {notifications.map((notif) => {
        const style = typeStyles[notif.type] || typeStyles.info;
        return (
          <div
            key={notif.id}
            role="alert"
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border shadow-lg transition-all duration-300 animate-in slide-in-from-bottom-2 ${style.bg} ${style.border}`}
          >
            {style.icon}
            <div className="flex-1 text-sm font-medium leading-snug">
              <span className={style.text}>{notif.message}</span>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notif.id)}
              aria-label="Dismiss notification"
              className="p-1 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

