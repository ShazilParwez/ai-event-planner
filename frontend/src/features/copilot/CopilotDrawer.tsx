import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  MessageSquare,
  Plus,
  Calendar,
} from 'lucide-react';
import { useCopilotStore } from '@/stores/useCopilotStore';
import { useEventStore } from '@/stores/useEventStore';
import { useEventsQuery } from '@/features/events/hooks';
import {
  useCopilotThreadsQuery,
  useCreateCopilotThreadMutation,
} from './hooks';
import { CopilotThreadList } from './CopilotThreadList';
import { CopilotChatView } from './CopilotChatView';
import { Button } from '@/components/ui/Button';

export const CopilotDrawer: React.FC = () => {
  const {
    isOpen,
    setOpen,
    activeThreadId,
    setActiveThreadId,
    isThreadsListOpen,
    setIsThreadsListOpen,
  } = useCopilotStore();

  const { activeEventId, activeEvent, setActiveEvent } = useEventStore();
  const { data: events = [] } = useEventsQuery();

  // Selected event resolution
  const currentEvent =
    events.find((e) => e.id === activeEventId) || activeEvent || events[0] || null;

  // Sync event store if not already set
  useEffect(() => {
    if (!activeEvent && currentEvent) {
      setActiveEvent(currentEvent);
    }
  }, [activeEvent, currentEvent, setActiveEvent]);

  const eventId = currentEvent?.id || null;

  // Threads for current event
  const { data: threads = [] } = useCopilotThreadsQuery(eventId);
  const createThreadMutation = useCreateCopilotThreadMutation(eventId || '');

  // Auto-select latest thread if none selected and threads exist
  useEffect(() => {
    if (isOpen && eventId && !activeThreadId && threads.length > 0 && threads[0]) {
      setActiveThreadId(threads[0].id);
    }
  }, [isOpen, eventId, activeThreadId, threads, setActiveThreadId]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  const handleStartNewChat = async () => {
    if (!eventId) return;
    try {
      await createThreadMutation.mutateAsync('New Chat');
    } catch (err) {
      console.error('Failed to create new chat', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-drawer-title"
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        {/* Drawer Panel Container */}
        <div className="w-screen max-w-md sm:max-w-xl md:max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h2
                    id="copilot-drawer-title"
                    className="text-sm font-bold text-slate-900 tracking-tight"
                  >
                    AI Event Copilot
                  </h2>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                    Active
                  </span>
                </div>
                {currentEvent ? (
                  <p className="text-xs text-slate-500 truncate flex items-center space-x-1 mt-0.5">
                    <span className="font-medium text-slate-700 truncate">
                      {currentEvent.title || currentEvent.name}
                    </span>
                    <span>•</span>
                    <span className="text-[10px] text-slate-400">
                      {currentEvent.currency || 'INR'}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">No active event</p>
                )}
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {eventId && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsThreadsListOpen(!isThreadsListOpen)}
                    className={`text-xs h-8 px-2 flex items-center space-x-1 ${
                      isThreadsListOpen
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Toggle Conversation Threads"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Chats</span>
                    {threads.length > 0 && (
                      <span className="ml-1 text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
                        {threads.length}
                      </span>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleStartNewChat}
                    disabled={createThreadMutation.isPending}
                    className="text-xs h-8 px-2 text-purple-700 hover:bg-purple-50"
                    title="Start New Chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">New</span>
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 h-8 w-8 p-0 rounded-lg"
                aria-label="Close AI Copilot"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            {!currentEvent ? (
              <div className="p-8 text-center my-auto space-y-4">
                <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl mx-auto flex items-center justify-center">
                  <Calendar className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    No Event Selected
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Please select or create an event in the Event Hub before consulting the AI Copilot.
                  </p>
                </div>
              </div>
            ) : isThreadsListOpen ? (
              <CopilotThreadList eventId={currentEvent.id} />
            ) : activeThreadId ? (
              <CopilotChatView
                eventId={currentEvent.id}
                threadId={activeThreadId}
                currency={currentEvent.currency || 'INR'}
              />
            ) : (
              <div className="p-8 text-center my-auto space-y-4">
                <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ready to Plan {currentEvent.title || currentEvent.name}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Start a conversation thread to ask questions, optimize your budget, or sequence event timelines.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStartNewChat}
                  disabled={createThreadMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs mx-auto"
                >
                  Start Planning Session
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
