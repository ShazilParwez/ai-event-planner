import { create } from 'zustand';
import { User, TokenResponse, UserLoginInput, UserRegisterInput, PasswordChangeInput } from '@/types/auth';
import { apiClient, configureApiAuth } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { useEventStore } from '@/stores/useEventStore';
import { useCopilotStore } from '@/stores/useCopilotStore';
import { useNotificationStore } from '@/stores/useNotificationStore';

const REFRESH_TOKEN_KEY = 'event_planner_refresh_token';

interface AuthStoreState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  login: (credentials: UserLoginInput) => Promise<void>;
  register: (credentials: UserRegisterInput) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshSession: () => Promise<string | null>;
  changePassword: (data: PasswordChangeInput) => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearAuthError: () => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,

  login: async (credentials) => {
    set({ isLoading: true, authError: null });
    try {
      const data = await apiClient.post<TokenResponse>('/auth/login', credentials, {
        skipAuth: true,
      });

      if (data.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }

      set({
        user: data.user,
        accessToken: data.access_token,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      useNotificationStore.getState().addNotification({
        type: 'success',
        message: `Welcome back, ${data.user.full_name || data.user.email}!`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please verify your credentials.';
      set({ authError: message, isLoading: false });
      throw err;
    }
  },

  register: async (credentials) => {
    set({ isLoading: true, authError: null });
    try {
      const data = await apiClient.post<TokenResponse>('/auth/register', credentials, {
        skipAuth: true,
      });

      if (data.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }

      set({
        user: data.user,
        accessToken: data.access_token,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      useNotificationStore.getState().addNotification({
        type: 'success',
        message: 'Account created successfully! Welcome to AI Event Planner.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      set({ authError: message, isLoading: false });
      throw err;
    }
  },

  logout: async (allDevices = false) => {
    const storedToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      await apiClient.post(
        '/auth/logout',
        { refresh_token: storedToken || undefined, all_devices: allDevices },
        { skipAuth: true }
      );
    } catch {
      // Fail safely on revocation or network errors during logout
    } finally {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);

      // Comprehensive state sanitization across all modules to prevent tenant data leakage
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        authError: null,
      });

      useEventStore.getState().setActiveEvent(null);
      useCopilotStore.getState().resetCopilotState();
      queryClient.clear();

      useNotificationStore.getState().addNotification({
        type: 'info',
        message: allDevices
          ? 'You have been logged out from all devices.'
          : 'Logged out successfully.',
      });
    }
  },

  refreshSession: async () => {
    const storedToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

    try {
      const data = await apiClient.post<TokenResponse>(
        '/auth/refresh',
        storedToken ? { refresh_token: storedToken } : {},
        { skipAuth: true }
      );

      if (data.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      }

      set({
        user: data.user,
        accessToken: data.access_token,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      return data.access_token;
    } catch {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      queryClient.clear();
      return null;
    }
  },

  changePassword: async (data) => {
    set({ isLoading: true, authError: null });
    try {
      const res = await apiClient.post<TokenResponse>('/auth/change-password', data);
      if (res.refresh_token) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, res.refresh_token);
      }

      set({
        user: res.user,
        accessToken: res.access_token,
        isLoading: false,
      });

      useNotificationStore.getState().addNotification({
        type: 'success',
        message: 'Password changed successfully. All previous sessions invalidated.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed.';
      set({ authError: message, isLoading: false });
      throw err;
    }
  },

  initializeAuth: async () => {
    if (get().isAuthenticated && get().accessToken) {
      set({ isLoading: false });
      return;
    }

    const storedToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedToken) {
      // Also try silent cookie refresh in case HttpOnly cookie is present without sessionStorage
      try {
        const res = await get().refreshSession();
        if (!res) {
          set({ isLoading: false, isAuthenticated: false });
        }
      } catch {
        set({ isLoading: false, isAuthenticated: false });
      }
      return;
    }

    await get().refreshSession();
  },

  clearAuthError: () => set({ authError: null }),
}));

// Wire API client authentication provider
configureApiAuth({
  getToken: () => useAuthStore.getState().accessToken,
  refreshToken: () => useAuthStore.getState().refreshSession(),
  onSessionExpired: () => {
    useAuthStore.getState().logout();
    useNotificationStore.getState().addNotification({
      type: 'warning',
      message: 'Your session has expired. Please sign in again.',
    });
  },
});
