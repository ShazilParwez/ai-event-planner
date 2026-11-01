import React from 'react';
import { useEventsQuery } from '@/features/events/hooks';
import { useEventStore } from '@/stores/useEventStore';
import { Card, Badge, Button } from '@/components/ui';
import { FallbackNotice } from '@/components/feedback';
import { formatCurrency } from '@/lib/currency';
import {
  CalendarDays,
  DollarSign,
  Users,
  CheckCircle2,
  ArrowRight,
  Plus,
  Sparkles,
  Heart,
  PartyPopper,
  Building2,
  TrendingUp,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToTab: (tab: string) => void;
  onCreateEvent: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToTab,
  onCreateEvent,
}) => {
  const { data: events = [] } = useEventsQuery();
  const { activeEventId, setActiveEvent } = useEventStore();

  const activeEvent =
    events.find((e) => e.id === activeEventId) || events[0] || null;

  const totalBudgetCombined = events.reduce(
    (acc, e) => acc + (Number(e.target_budget) || 0),
    0
  );

  const totalGuestsCombined = events.reduce(
    (acc, e) => acc + (Number(e.expected_guest_count) || 0),
    0
  );

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'WEDDING':
        return <Heart className="w-4 h-4 text-rose-500" />;
      case 'BIRTHDAY':
        return <PartyPopper className="w-4 h-4 text-amber-500" />;
      case 'COMMUNITY':
        return <Building2 className="w-4 h-4 text-blue-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Event Command Center
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time financial rollups, active blueprint status, and event portfolios.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            onClick={() => onNavigateToTab('events')}
            className="text-xs"
          >
            <CalendarDays className="w-4 h-4 mr-1.5 text-slate-500" />
            <span>Events Hub</span>
          </Button>
          <Button
            variant="primary"
            onClick={onCreateEvent}
            className="text-xs flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </Button>
        </div>
      </div>

      <FallbackNotice source="mock" />

      {/* Aggregate Metric Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Events Portfolio</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{events.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Weddings, Birthdays & Community</p>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Managed Budget</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 truncate">
            {formatCurrency(totalBudgetCombined, { currency: 'INR' })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Combined target allocations</p>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Headcount</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalGuestsCombined}</div>
          <p className="text-[11px] text-slate-500 mt-1">Expected guest attendees</p>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Budget Precision</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">100%</div>
          <p className="text-[11px] text-slate-500 mt-1">Strict Decimal deterministic math</p>
        </Card>
      </div>

      {/* Active Event Spotlight */}
      {activeEvent ? (
        <Card className="p-6 border-emerald-200 bg-gradient-to-r from-emerald-50/40 via-white to-teal-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
                  {getEventIcon(activeEvent.event_type)}
                </span>
                <span className="text-xs font-bold text-emerald-800 tracking-wider uppercase">
                  Active Event Focus
                </span>
                <Badge variant="success">{activeEvent.status}</Badge>
              </div>

              <h3 className="text-xl font-bold text-slate-900">
                {activeEvent.title || activeEvent.name}
              </h3>

              {activeEvent.description && (
                <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                  {activeEvent.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                <div className="flex items-center space-x-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(Number(activeEvent.target_budget), {
                      currency: activeEvent.currency || 'INR',
                    })}
                  </span>
                  <span>target</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeEvent.expected_guest_count || 0} Guests</span>
                </div>

                {activeEvent.location && (
                  <div className="flex items-center space-x-1.5 text-slate-500">
                    <span>•</span>
                    <span>{activeEvent.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToTab('events')}
                className="text-xs"
              >
                Switch Event
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveEvent(activeEvent);
                  onNavigateToTab('budget');
                }}
                className="text-xs flex items-center space-x-1.5"
              >
                <span>Open Budget Intelligence</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center border-dashed border-slate-300">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-base font-semibold text-slate-800">No Events in Portfolio</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Create an event to activate real-time budget intelligence, timeline generation, and checklists.
          </p>
          <Button variant="primary" size="sm" onClick={onCreateEvent} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Your First Event
          </Button>
        </Card>
      )}

      {/* Recent Events List */}
      {events.length > 0 && (
        <Card className="border-slate-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Event Portfolio Quick Access</span>
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigateToTab('events')}
              className="text-xs text-emerald-700"
            >
              <span>View All Events</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 rounded-lg px-2 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {event.title || event.name}
                    </h4>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                      <span className="capitalize">{event.event_type.toLowerCase()}</span>
                      <span>•</span>
                      <span>
                        {formatCurrency(Number(event.target_budget), {
                          currency: event.currency || 'INR',
                        })}
                      </span>
                      <span>•</span>
                      <span>{event.expected_guest_count || 0} guests</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setActiveEvent(event);
                      onNavigateToTab('budget');
                    }}
                  >
                    Manage Budget
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
