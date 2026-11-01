import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginForm } from '@/features/auth/LoginForm';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { ChangePasswordModal } from '@/features/auth/ChangePasswordModal';
import { UserMenu } from '@/features/auth/UserMenu';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { NotificationToast } from '@/components/ui/NotificationToast';
import { useAuthStore } from '@/stores/useAuthStore';
import { useEventStore } from '@/stores/useEventStore';
import { useCopilotStore } from '@/stores/useCopilotStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { apiClient } from '@/lib/api-client';

describe('Phase 6D.1: Frontend Authentication Security & Integration Audit Tests', () => {
  const mockUser = {
    id: 'user-auth-uuid-1',
    email: 'sarah.eventplanner@example.com',
    full_name: 'Sarah Jenkins',
    is_active: true,
    is_superuser: false,
    created_at: new Date().toISOString(),
  };

  const mockAdminUser = {
    id: 'admin-uuid-1',
    email: 'admin@eventplanner.com',
    full_name: 'Lead Director',
    is_active: true,
    is_superuser: true,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      authError: null,
    });
    useNotificationStore.getState().clearAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LoginForm Component & Storage Security', () => {
    it('renders email, password inputs, submit button, and switch to register', () => {
      render(<LoginForm onSwitchToRegister={vi.fn()} />);

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create an account/i })).toBeInTheDocument();
    });

    it('validates invalid email format and required password before submitting', async () => {
      const handleSwitch = vi.fn();
      render(<LoginForm onSwitchToRegister={handleSwitch} />);

      const emailInput = screen.getByLabelText(/email address/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email-format' } });

      const submitBtn = screen.getByRole('button', { name: /^sign in$/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('toggles password visibility between password and text type', () => {
      render(<LoginForm onSwitchToRegister={vi.fn()} />);

      const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      const toggleBtn = screen.getByLabelText(/show password/i);
      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(screen.getByLabelText(/hide password/i));
      expect(passwordInput.type).toBe('password');
    });

    it('displays error banner when authentication fails', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Incorrect email or password.'));

      render(<LoginForm onSwitchToRegister={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'wrongpassword' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
      });
    });

    it('successfully calls login, updates in-memory store, and saves session token', async () => {
      const mockSuccess = vi.fn();
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        access_token: 'jwt-access-token-123',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-xyz',
        user: mockUser,
      });

      render(<LoginForm onSwitchToRegister={vi.fn()} onSuccess={mockSuccess} />);

      fireEvent.change(screen.getByLabelText(/email address/i), {
        target: { value: 'sarah.eventplanner@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), {
        target: { value: 'CorrectPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
        expect(useAuthStore.getState().user?.email).toBe('sarah.eventplanner@example.com');
        expect(sessionStorage.getItem('event_planner_refresh_token')).toBe('refresh-token-xyz');
        expect(mockSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('RegisterForm Component', () => {
    it('validates password minimum length of 8 characters', async () => {
      render(<RegisterForm onSwitchToLogin={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email address \*/i), {
        target: { value: 'newuser@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password \*/i), {
        target: { value: 'short' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
        target: { value: 'short' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 8 characters long/i)
        ).toBeInTheDocument();
      });
    });

    it('validates matching confirmation password', async () => {
      render(<RegisterForm onSwitchToLogin={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/email address \*/i), {
        target: { value: 'newuser@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password \*/i), {
        target: { value: 'ValidPassword123' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
        target: { value: 'MismatchedPassword123' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('submits registration successfully and establishes active session', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        access_token: 'new-user-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'new-user-refresh-token',
        user: {
          ...mockUser,
          email: 'newuser@example.com',
          full_name: 'New Event Planner',
        },
      });

      render(<RegisterForm onSwitchToLogin={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/full name/i), {
        target: { value: 'New Event Planner' },
      });
      fireEvent.change(screen.getByLabelText(/email address \*/i), {
        target: { value: 'newuser@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/^password \*/i), {
        target: { value: 'SecurePassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
        target: { value: 'SecurePassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
        expect(useAuthStore.getState().user?.email).toBe('newuser@example.com');
        expect(sessionStorage.getItem('event_planner_refresh_token')).toBe('new-user-refresh-token');
      });
    });
  });

  describe('ChangePasswordModal Component', () => {
    it('validates that new password cannot be the same as current password', async () => {
      render(<ChangePasswordModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.change(screen.getByLabelText(/current password \*/i), {
        target: { value: 'OldPassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/^new password \*/i), {
        target: { value: 'OldPassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm new password \*/i), {
        target: { value: 'OldPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/new password must be different from current password/i)
        ).toBeInTheDocument();
      });
    });

    it('calls change password API and closes modal on success', async () => {
      const handleClose = vi.fn();
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        access_token: 'updated-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'updated-refresh-token',
        user: mockUser,
      });

      render(<ChangePasswordModal isOpen={true} onClose={handleClose} />);

      fireEvent.change(screen.getByLabelText(/current password \*/i), {
        target: { value: 'OldPassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/^new password \*/i), {
        target: { value: 'BrandNewPassword123!' },
      });
      fireEvent.change(screen.getByLabelText(/confirm new password \*/i), {
        target: { value: 'BrandNewPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
        expect(useAuthStore.getState().accessToken).toBe('updated-access-token');
      });
    });
  });

  describe('UserMenu and Multi-Tenant Isolation Logout Flow', () => {
    it('renders user details, initials, and Planner role badge for standard user', () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });

      render(<UserMenu />);

      expect(screen.getByText('SJ')).toBeInTheDocument();
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
      expect(screen.getByText('Planner')).toBeInTheDocument();
    });

    it('renders Administrator badge for superuser', () => {
      useAuthStore.setState({ user: mockAdminUser, isAuthenticated: true });

      render(<UserMenu />);

      expect(screen.getByText('LD')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
    });

    it('opens confirmation modal, terminates session on sign out, and purges all tenant state (Event & Copilot)', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true });
      sessionStorage.setItem('event_planner_refresh_token', 'token-to-revoke');
      useEventStore.getState().setActiveEvent({
        id: 'event-user-1',
        title: "User 1 Event",
        event_type: 'WEDDING',
        status: 'PLANNING',
        currency: 'INR',
        target_budget: 100000,
        expected_guest_count: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      useCopilotStore.setState({
        activeThreadId: 'thread-user-1',
        draftMessage: 'Secret tenant message',
        messages: [{ role: 'user', content: 'Secret User 1 Note' }],
      });

      const logoutSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({});

      render(<UserMenu />);

      // Open profile menu
      fireEvent.click(screen.getByLabelText(/user profile menu/i));

      // Click sign out menu item
      fireEvent.click(screen.getByText(/sign out\.\.\./i));

      // Confirm sign out dialog is displayed
      expect(screen.getByText('Confirm Sign Out')).toBeInTheDocument();

      // Check "all devices" checkbox
      const allDevicesCheckbox = screen.getByLabelText(/sign out from all devices/i);
      fireEvent.click(allDevicesCheckbox);

      // Click Confirm Sign Out button
      const confirmSignOutBtn = screen.getByRole('button', { name: /^sign out$/i });
      fireEvent.click(confirmSignOutBtn);

      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalledWith(
          '/auth/logout',
          { refresh_token: 'token-to-revoke', all_devices: true },
          { skipAuth: true }
        );
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        // MULTI-TENANT ISOLATION ASSERTIONS:
        expect(sessionStorage.getItem('event_planner_refresh_token')).toBeNull();
        expect(useEventStore.getState().activeEvent).toBeNull();
        expect(useCopilotStore.getState().activeThreadId).toBeNull();
        expect(useCopilotStore.getState().draftMessage).toBe('');
        expect(useCopilotStore.getState().messages[0]?.role).toBe('assistant');
      });
    });
  });

  describe('ErrorBoundary Component Security', () => {
    const ProblematicComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Simulation of unexpected React rendering error');
      }
      return <div>Normal Content Loaded</div>;
    };

    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary sectionName="Budget Module">
          <ProblematicComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Normal Content Loaded')).toBeInTheDocument();
    });

    it('catches render error, renders graceful recovery UI, and displays technical details safely', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary sectionName="Budget Module">
          <ProblematicComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(/an unexpected error occurred in budget module/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

      // Expand error details
      const detailsBtn = screen.getByRole('button', { name: /show error details/i });
      fireEvent.click(detailsBtn);

      expect(
        screen.getByText(/simulation of unexpected react rendering error/i)
      ).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('NotificationToast Component', () => {
    it('renders notification and removes it on dismiss click', async () => {
      act(() => {
        useNotificationStore.getState().addNotification({
          type: 'success',
          message: 'Milestone marked as complete.',
          durationMs: 0,
        });
      });

      render(<NotificationToast />);

      expect(screen.getByText('Milestone marked as complete.')).toBeInTheDocument();

      const dismissBtn = screen.getByLabelText(/dismiss notification/i);
      fireEvent.click(dismissBtn);

      await waitFor(() => {
        expect(screen.queryByText('Milestone marked as complete.')).not.toBeInTheDocument();
      });
    });

    it('deduplicates identical consecutive notifications', () => {
      act(() => {
        useNotificationStore.getState().addNotification({
          type: 'info',
          message: 'Identical repeated notification',
          durationMs: 0,
        });
        useNotificationStore.getState().addNotification({
          type: 'info',
          message: 'Identical repeated notification',
          durationMs: 0,
        });
      });

      render(<NotificationToast />);

      expect(screen.getAllByText('Identical repeated notification')).toHaveLength(1);
    });
  });

  describe('ApiClient 401, 403 & Concurrency Queue', () => {
    it('surfaces warning notification on HTTP 403 without logging out the user', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'valid-token' });

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          message: 'Permission denied: You do not own this event.',
        }),
      } as unknown as Response);

      await expect(apiClient.get('/events/restricted-id')).rejects.toThrow(
        /permission denied: you do not own this event/i
      );

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      const notifs = useNotificationStore.getState().notifications;
      expect(notifs.some((n) => n.type === 'warning' && n.message.includes('Permission denied'))).toBe(
        true
      );

      global.fetch = originalFetch;
    });

    it('queues concurrent requests during 401 to prevent RFC 6819 token reuse detection trip and includes credentials', async () => {
      useAuthStore.setState({ user: mockUser, isAuthenticated: true, accessToken: 'expired-token' });
      sessionStorage.setItem('event_planner_refresh_token', 'initial-refresh-token');

      let refreshCallCount = 0;
      let credentialsIncludedOnAllCalls = true;
      const originalFetch = global.fetch;

      let callIndex = 0;
      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.credentials !== 'include') {
          credentialsIncludedOnAllCalls = false;
        }

        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                access_token: 'freshly-rotated-access-token',
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: 'new-rotated-refresh-token',
                user: mockUser,
              },
            }),
          } as unknown as Response;
        }

        callIndex++;
        if (callIndex <= 2) {
          return {
            ok: false,
            status: 401,
            json: async () => ({
              success: false,
              detail: 'Signature has expired',
            }),
          } as unknown as Response;
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { result: 'success' },
          }),
        } as unknown as Response;
      });

      const [res1, res2] = await Promise.all([
        apiClient.get<{ result: string }>('/budget/items'),
        apiClient.get<{ result: string }>('/timeline/milestones'),
      ]);

      expect(res1.result).toBe('success');
      expect(res2.result).toBe('success');

      // CRITICAL ASSERTIONS:
      // 1. Exactly ONE refresh call executed across parallel 401s
      expect(refreshCallCount).toBe(1);
      // 2. Credentials included for HttpOnly cookie support
      expect(credentialsIncludedOnAllCalls).toBe(true);
      // 3. Updated in-memory access token
      expect(useAuthStore.getState().accessToken).toBe('freshly-rotated-access-token');

      global.fetch = originalFetch;
    });
  });
});
