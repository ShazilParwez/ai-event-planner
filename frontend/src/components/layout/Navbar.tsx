import React from 'react';
import { Sparkles, Calendar, Eye } from 'lucide-react';
import { useCopilotStore } from '@/stores/useCopilotStore';
import { useEventStore } from '@/stores/useEventStore';
import { useAccessibilitySettingsStore } from '@/stores/useAccessibilitySettingsStore';
import { useEventsQuery } from '@/features/events/hooks';
import { Button } from '@/components/ui';
import { UserMenu } from '@/features/auth';

export const Navbar: React.FC = () => {
  const { toggleOpen, isOpen } = useCopilotStore();
  const { activeEventId, activeEvent, setActiveEvent } = useEventStore();
  const { setSettingsModalOpen } = useAccessibilitySettingsStore();
  const { data: events = [] } = useEventsQuery();

  const currentEvent =
    events.find((e) => e.id === activeEventId) || activeEvent || events[0] || null;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">AI Event Planner</h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Intelligent Planning Assistant for Weddings, Birthdays & Community Events
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {events.length > 0 && (
            <div className="relative hidden md:flex items-center space-x-2 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Event:</span>
              <select
                value={currentEvent?.id || ''}
                onChange={(e) => {
                  const ev = events.find((item) => item.id === e.target.value);
                  if (ev) setActiveEvent(ev);
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-4"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title || ev.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsModalOpen(true)}
            className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 flex items-center space-x-1.5"
            aria-label="Open accessibility and assistive settings"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline font-medium text-xs">Accessibility</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleOpen}
            className="border-purple-300 text-purple-700 bg-purple-50/50 hover:bg-purple-100 flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
            <span className="font-semibold">{isOpen ? 'Close Copilot' : 'AI Copilot'}</span>
          </Button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
};
