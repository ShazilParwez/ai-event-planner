import { create } from 'zustand';
import { Event } from '@/types/event';

interface EventStoreState {
  activeEventId: string | null;
  activeEvent: Event | null;
  setActiveEventId: (id: string | null) => void;
  setActiveEvent: (event: Event | null) => void;
}

export const useEventStore = create<EventStoreState>((set) => ({
  activeEventId: null,
  activeEvent: null,
  setActiveEventId: (id) => set({ activeEventId: id }),
  setActiveEvent: (event) => set({ activeEvent: event, activeEventId: event ? event.id : null }),
}));

