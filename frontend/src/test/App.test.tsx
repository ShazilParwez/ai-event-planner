import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';
import { useAuthStore } from '../stores/useAuthStore';

describe('App Foundation Root Component', () => {
  const mockUser = {
    id: 'user-123',
    email: 'admin@eventplanner.com',
    full_name: 'Lead Event Director',
    is_active: true,
    is_superuser: true,
    created_at: new Date().toISOString(),
  };

  describe('When Authenticated', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isLoading: false,
        user: mockUser,
        accessToken: 'mock-valid-jwt',
      });
    });

    it('renders application header and title', () => {
      render(<App />);
      expect(screen.getByText('AI Event Planner')).toBeInTheDocument();
    });

    it('renders main navigation tabs and command center', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Event Command Center')).toBeInTheDocument();
      });
      expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Events Hub').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Budget Intelligence').length).toBeGreaterThanOrEqual(1);
    });

    it('renders quick action buttons for event creation', async () => {
      render(<App />);
      await waitFor(() => {
        expect(screen.getAllByText('New Event').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('When Unauthenticated', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
      });
    });

    it('renders the authentication page with Sign In and Create Account tabs', () => {
      render(<App />);
      expect(screen.getByText('AI Event Planner')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });
  });
});
