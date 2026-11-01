import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  durationMs?: number;
}

interface NotificationStoreState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

let notificationCounter = 0;

export const useNotificationStore = create<NotificationStoreState>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    // Deduplicate identical consecutive notifications
    const existing = get().notifications;
    if (existing.length > 0) {
      const last = existing[existing.length - 1];
      if (last && last.type === notification.type && last.message === notification.message) {
        return last.id;
      }
    }

    notificationCounter += 1;
    const id = `notif-${Date.now()}-${notificationCounter}`;
    const newNotification: Notification = {
      ...notification,
      id,
      durationMs: notification.durationMs ?? 5000,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    if (newNotification.durationMs && newNotification.durationMs > 0) {
      setTimeout(() => {
        get().dismissNotification(id);
      }, newNotification.durationMs);
    }

    return id;
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));
