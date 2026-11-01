import React, { useState, useEffect, Suspense, lazy } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/query-client';
import { Navbar, Sidebar, Container } from '@/components/layout';
import { EventFormModal, useCreateEventMutation } from '@/features/events';
import { EventCreateInput } from '@/types/event';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthPage } from '@/features/auth';
import { NotificationToast } from '@/components/ui';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { AccessibilitySettingsModal } from '@/components/accessibility/AccessibilitySettingsModal';

// Code-split feature views for optimal bundle performance
const DashboardView = lazy(() =>
  import('@/features/dashboard').then((m) => ({ default: m.DashboardView }))
);
const EventsView = lazy(() =>
  import('@/features/events').then((m) => ({ default: m.EventsView }))
);
const AccessibilityView = lazy(() =>
  import('@/features/accessibility').then((m) => ({ default: m.AccessibilityView }))
);
const BudgetView = lazy(() =>
  import('@/features/budget').then((m) => ({ default: m.BudgetView }))
);
const TimelineView = lazy(() =>
  import('@/features/timeline').then((m) => ({ default: m.TimelineView }))
);
const VendorView = lazy(() =>
  import('@/features/vendors').then((m) => ({ default: m.VendorView }))
);
const GuestView = lazy(() =>
  import('@/features/guests').then((m) => ({ default: m.GuestView }))
);
const InspirationView = lazy(() =>
  import('@/features/inspiration').then((m) => ({ default: m.InspirationView }))
);
const CopilotDrawer = lazy(() =>
  import('@/features/copilot').then((m) => ({ default: m.CopilotDrawer }))
);

const ViewLoadingFallback: React.FC = () => (
  <div
    role="status"
    aria-label="Loading view"
    className="h-96 flex flex-col items-center justify-center space-y-3 text-slate-400"
  >
    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    <span className="text-sm font-medium text-slate-500">Loading workspace...</span>
  </div>
);

export const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const createEventMutation = useCreateEventMutation();

  const handleQuickCreateSubmit = async (data: EventCreateInput) => {
    await createEventMutation.mutateAsync(data);
    setActiveTab('events');
  };

  // Loading state while verifying existing session
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Initializing authentication"
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4"
      >
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-slate-600">Verifying session...</p>
      </div>
    );
  }

  // Unauthenticated view: Render Auth Landing Page
  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        <NotificationToast />
      </>
    );
  }

  // Authenticated workspace
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Navbar />

      <div className="flex-1 flex">
        <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

        <main className="flex-1 p-4 sm:p-6 md:p-8" id="main-content">
          <Container>
            <ErrorBoundary sectionName={`${activeTab.toUpperCase()} Workspace`}>
              <Suspense fallback={<ViewLoadingFallback />}>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    onNavigateToTab={setActiveTab}
                    onCreateEvent={() => setIsQuickCreateOpen(true)}
                  />
                )}

                {activeTab === 'events' && (
                  <EventsView onNavigateToBudget={() => setActiveTab('budget')} />
                )}

                {activeTab === 'accessibility' && (
                  <AccessibilityView />
                )}

                {activeTab === 'budget' && (
                  <BudgetView onNavigateToEvents={() => setActiveTab('events')} />
                )}

                {activeTab === 'timeline' && (
                  <TimelineView onNavigateToEvents={() => setActiveTab('events')} />
                )}

                {activeTab === 'vendors' && (
                  <VendorView onNavigateToEvents={() => setActiveTab('events')} />
                )}

                {activeTab === 'guests' && (
                  <GuestView onNavigateToEvents={() => setActiveTab('events')} />
                )}

                {activeTab === 'inspiration' && (
                  <InspirationView onNavigateToEvents={() => setActiveTab('events')} />
                )}
              </Suspense>
            </ErrorBoundary>
          </Container>
        </main>
      </div>

      <EventFormModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onSubmit={handleQuickCreateSubmit}
        isLoading={createEventMutation.isPending}
      />

      <Suspense fallback={null}>
        <CopilotDrawer />
      </Suspense>

      <AccessibilitySettingsModal />

      <NotificationToast />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary sectionName="Application Root">
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
