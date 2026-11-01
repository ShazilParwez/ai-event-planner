import React, { useState } from 'react';
import { Event, EventCreateInput, EventType } from '@/types/event';
import {
  useEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
} from './hooks';
import { useEventStore } from '@/stores/useEventStore';
import { EventFormModal } from './EventFormModal';
import { DeleteEventModal } from './DeleteEventModal';
import { Badge, Button, Input } from '@/components/ui';
import { formatCurrency } from '@/lib/currency';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Edit2,
  Trash2,
  ArrowRight,
  Heart,
  PartyPopper,
  Building2,
  Sparkles,
} from 'lucide-react';

interface EventsViewProps {
  onNavigateToBudget?: (eventId: string) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({ onNavigateToBudget }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);

  const { activeEventId, setActiveEvent } = useEventStore();

  const { data: events = [], isLoading, error } = useEventsQuery({
    search: search || undefined,
    event_type: typeFilter || undefined,
  });

  const createMutation = useCreateEventMutation();
  const updateMutation = useUpdateEventMutation();
  const deleteMutation = useDeleteEventMutation();

  const handleCreateSubmit = async (data: EventCreateInput) => {
    await createMutation.mutateAsync(data);
  };

  const handleEditSubmit = async (data: EventCreateInput) => {
    if (!editingEvent) return;
    await updateMutation.mutateAsync({ id: editingEvent.id, data });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEvent) return;
    await deleteMutation.mutateAsync(deletingEvent.id);
    setDeletingEvent(null);
  };

  const getEventIcon = (type: EventType) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge variant="success">Confirmed</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>;
      case 'COMPLETED':
        return <Badge variant="purple">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">Planning</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Event Hub</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage your weddings, birthdays, and community celebrations with deterministic budgets.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events by title or location..."
            className="pl-9 bg-white"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Event Types</option>
            <option value="WEDDING">Wedding</option>
            <option value="BIRTHDAY">Birthday</option>
            <option value="COMMUNITY">Community</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          Failed to load events: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && events.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No Events Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Get started by initializing your first event. Set budget targets, guest headcounts, and schedules.
          </p>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Event
          </Button>
        </div>
      )}

      {/* Event Cards Grid */}
      {!isLoading && !error && events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => {
            const isActive = activeEventId === event.id;
            return (
              <div
                key={event.id}
                className={`bg-white rounded-xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isActive
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'border-slate-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-slate-100 rounded-md">
                        {getEventIcon(event.event_type)}
                      </div>
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        {event.event_type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {getStatusBadge(event.status)}
                      <button
                        onClick={() => setEditingEvent(event)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100"
                        title="Edit event"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingEvent(event)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1.5 line-clamp-1">
                    {event.title || event.name}
                  </h3>

                  {event.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                      {event.description}
                    </p>
                  )}

                  <div className="space-y-2 text-xs text-slate-600 my-3">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(Number(event.target_budget || 0), {
                          currency: event.currency || 'INR',
                        })}
                      </span>
                      <span className="text-slate-400">budget</span>
                    </div>

                    {event.location && (
                      <div className="flex items-center space-x-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    {event.start_date && (
                      <div className="flex items-center space-x-2 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{new Date(event.start_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{event.expected_guest_count || 0} Expected Guests</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveEvent(event)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isActive ? 'Active Plan' : 'Select Event'}
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
                    onClick={() => {
                      setActiveEvent(event);
                      onNavigateToBudget?.(event.id);
                    }}
                  >
                    <span>Manage Budget</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <EventFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={createMutation.isPending}
      />

      <EventFormModal
        isOpen={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        onSubmit={handleEditSubmit}
        initialData={editingEvent}
        isLoading={updateMutation.isPending}
      />

      <DeleteEventModal
        isOpen={Boolean(deletingEvent)}
        onClose={() => setDeletingEvent(null)}
        onConfirm={handleDeleteConfirm}
        event={deletingEvent}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
