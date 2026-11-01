# ADR 0004: Frontend State Management and Data Fetching

## Status
Accepted

## Context
The AI Event Planner frontend must synchronize complex relational data (events, budgets, timelines, vendors, guests) with real-time UI state (active tab, copilot chat drawer, modals, filters).

## Decision
We separated client UI state from server cache:
- **Zustand**: Lightweight global stores (`useEventStore`, `useCopilotStore`) for purely client-driven UI state, drawer toggles, and active event ID references.
- **TanStack React Query v5**: Server state synchronization, automatic background caching, query invalidation on mutation, and optimistic updates.

## Consequences
- **Positive**:
  - Clean separation: zero boilerplates for server data in client stores.
  - Automatic cache invalidation when budget items or milestones are created/updated.
  - Fast response times and zero unnecessary component re-renders.
- **Negative**:
  - Developers must understand the boundary between server state (React Query) and client UI state (Zustand).

