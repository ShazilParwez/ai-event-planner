import React, { useState } from 'react';
import { Users, UserPlus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useEventStore } from '@/stores/useEventStore';
import {
  useGuestsQuery,
  useGuestAnalyticsQuery,
  useCreateGuestMutation,
  useUpdateGuestMutation,
  useDeleteGuestMutation,
  useUpdateGuestRSVPMutation,
  useUpdateGuestInvitationMutation,
} from './hooks';
import { GuestAnalyticsCards } from './GuestAnalyticsCards';
import { GuestDirectoryTable } from './GuestDirectoryTable';
import { GuestModal } from './GuestModal';
import { Guest, GuestCreatePayload, GuestUpdatePayload, RSVPStatus, InvitationStatus } from '@/types/guest';

interface GuestViewProps {
  onNavigateToEvents?: () => void;
}

export const GuestView: React.FC<GuestViewProps> = ({ onNavigateToEvents }) => {
  const { activeEvent } = useEventStore();
  const eventId = activeEvent?.id || null;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRSVP, setSelectedRSVP] = useState('All');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);

  // Queries
  const queryParams = {
    search: searchQuery || undefined,
    category: selectedCategory !== 'All' ? selectedCategory : undefined,
    rsvp_status: selectedRSVP !== 'All' ? selectedRSVP : undefined,
  };

  const { data: guestsData, isLoading: isGuestsLoading } = useGuestsQuery(eventId, queryParams);
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useGuestAnalyticsQuery(eventId);

  // Mutations
  const createMutation = useCreateGuestMutation(eventId || '');
  const updateMutation = useUpdateGuestMutation(eventId || '');
  const deleteMutation = useDeleteGuestMutation(eventId || '');
  const rsvpMutation = useUpdateGuestRSVPMutation(eventId || '');
  const invitationMutation = useUpdateGuestInvitationMutation(eventId || '');

  // No active event prompt
  if (!activeEvent) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center max-w-lg mx-auto shadow-sm">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Event Selected</h3>
        <p className="text-sm text-gray-500 mb-6">
          Please select an active event from the Events Hub to manage its guest roster, headcounts, and catering dietary matrix.
        </p>
        {onNavigateToEvents && (
          <Button variant="primary" onClick={onNavigateToEvents}>
            Go to Events Hub
          </Button>
        )}
      </div>
    );
  }

  const handleOpenAddModal = () => {
    setEditingGuest(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (guest: Guest) => {
    setEditingGuest(guest);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (data: GuestCreatePayload | GuestUpdatePayload) => {
    if (editingGuest) {
      await updateMutation.mutateAsync({
        guestId: editingGuest.id,
        data: data as GuestUpdatePayload,
      });
    } else {
      await createMutation.mutateAsync(data as GuestCreatePayload);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingGuest) {
      await deleteMutation.mutateAsync(deletingGuest.id);
      setDeletingGuest(null);
    }
  };

  const handleQuickUpdateRSVP = (guestId: string, status: RSVPStatus) => {
    rsvpMutation.mutate({ guestId, rsvpStatus: status });
  };

  const handleQuickUpdateInvitation = (guestId: string, status: InvitationStatus) => {
    invitationMutation.mutate({ guestId, invitationStatus: status });
  };

  const guestsList = guestsData?.items || [];

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Guest Roster & RSVP Matrix</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {activeEvent.title}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Deterministic headcount forecasting, dietary accommodations, and invitation delivery.</span>
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Guest</span>
        </Button>
      </div>

      {/* Analytics KPI Cards */}
      <GuestAnalyticsCards analytics={analyticsData} isLoading={isAnalyticsLoading} />

      {/* Guest Directory & Filters */}
      <GuestDirectoryTable
        guests={guestsList}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedRSVP={selectedRSVP}
        onRSVPChange={setSelectedRSVP}
        onEditGuest={handleOpenEditModal}
        onDeleteGuest={(g) => setDeletingGuest(g)}
        onQuickUpdateRSVP={handleQuickUpdateRSVP}
        onQuickUpdateInvitation={handleQuickUpdateInvitation}
        isLoading={isGuestsLoading}
      />

      {/* Add / Edit Guest Modal */}
      <GuestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        guest={editingGuest}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      {deletingGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Remove Guest from Roster?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <strong className="text-gray-900">{deletingGuest.name}</strong> from{' '}
              {activeEvent.title}? This will also remove their RSVP response and dietary preferences from the event calculations.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setDeletingGuest(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove Guest'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
