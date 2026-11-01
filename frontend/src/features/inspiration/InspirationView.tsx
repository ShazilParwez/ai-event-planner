import React, { useState } from 'react';
import { Sparkles, Plus, Lightbulb, Bookmark, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useEventStore } from '@/stores/useEventStore';
import {
  useInspirationCardsQuery,
  useCreateInspirationCardMutation,
  useUpdateInspirationCardMutation,
  useDeleteInspirationCardMutation,
  useToggleSaveInspirationCardMutation,
  useGenerateInspirationMutation,
} from './hooks';
import { InspirationCardItem } from './InspirationCardItem';
import { InspirationCardModal } from './InspirationCardModal';
import { GenerateInspirationModal } from './GenerateInspirationModal';
import {
  InspirationCard,
  InspirationCategory,
  InspirationCardCreatePayload,
  InspirationCardUpdatePayload,
} from '@/types/inspiration';

interface InspirationViewProps {
  onNavigateToEvents?: () => void;
}

const CATEGORIES: ('All Categories' | InspirationCategory)[] = [
  'All Categories',
  'Event Themes',
  'Decorations',
  'Color Palettes',
  'Catering and Menus',
  'Entertainment',
  'Photography Concepts',
  'Invitations',
  'Activities',
  'Other',
];

export const InspirationView: React.FC<InspirationViewProps> = ({ onNavigateToEvents }) => {
  const { activeEvent } = useEventStore();
  const eventId = activeEvent?.id || null;

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(false);

  // Modal states
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<InspirationCard | null>(null);
  const [deletingCard, setDeletingCard] = useState<InspirationCard | null>(null);

  // Queries & Mutations
  const queryParams = {
    category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
    is_saved: showSavedOnly ? true : undefined,
  };

  const { data: cards, isLoading } = useInspirationCardsQuery(eventId, queryParams);
  const createMutation = useCreateInspirationCardMutation(eventId || '');
  const updateMutation = useUpdateInspirationCardMutation(eventId || '');
  const deleteMutation = useDeleteInspirationCardMutation(eventId || '');
  const toggleSaveMutation = useToggleSaveInspirationCardMutation(eventId || '');
  const generateMutation = useGenerateInspirationMutation(eventId || '');

  if (!activeEvent) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center max-w-lg mx-auto shadow-sm">
        <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Active Event Selected</h3>
        <p className="text-sm text-gray-500 mb-6">
          Please select an active event from the Events Hub to browse moodboards, curated aesthetics, and AI creative concepts.
        </p>
        {onNavigateToEvents && (
          <Button variant="primary" onClick={onNavigateToEvents}>
            Go to Events Hub
          </Button>
        )}
      </div>
    );
  }

  const handleOpenAddCard = () => {
    setEditingCard(null);
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = (card: InspirationCard) => {
    setEditingCard(card);
    setIsCardModalOpen(true);
  };

  const handleCardModalSubmit = async (
    data: InspirationCardCreatePayload | InspirationCardUpdatePayload
  ) => {
    if (editingCard) {
      await updateMutation.mutateAsync({
        cardId: editingCard.id,
        data: data as InspirationCardUpdatePayload,
      });
    } else {
      await createMutation.mutateAsync(data as InspirationCardCreatePayload);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingCard) {
      await deleteMutation.mutateAsync(deletingCard.id);
      setDeletingCard(null);
    }
  };

  const handleToggleSave = (cardId: string) => {
    toggleSaveMutation.mutate(cardId);
  };

  const handleGenerateIdeas = async (data: {
    category?: string | null;
    custom_prompt?: string | null;
    num_ideas?: number;
  }) => {
    const res = await generateMutation.mutateAsync({
      event_id: eventId!,
      category: data.category,
      custom_prompt: data.custom_prompt,
      num_ideas: data.num_ideas,
    });
    return res;
  };

  const handleSaveGeneratedIdea = async (ideaPayload: InspirationCardCreatePayload) => {
    await createMutation.mutateAsync(ideaPayload);
  };

  const cardsList = cards || [];
  const savedCount = cardsList.filter((c) => c.is_saved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Inspiration Studio & Moodboard</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {activeEvent.title}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Theme aesthetics, color palettes, decor concepts, and AI-powered ideas.</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Generate Ideas (AI)</span>
          </Button>

          <Button
            variant="primary"
            onClick={handleOpenAddCard}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Idea</span>
          </Button>
        </div>
      </div>

      {/* Category Pills & Saved Toggle Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Navigation Scrollable Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Saved Ideas Toggle */}
          <button
            onClick={() => setShowSavedOnly((prev) => !prev)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shrink-0 ${
              showSavedOnly
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${showSavedOnly ? 'fill-amber-600 text-amber-600' : 'text-gray-400'}`} />
            <span>Saved Only ({savedCount})</span>
          </button>
        </div>
      </div>

      {/* Gallery Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 h-64" />
          ))}
        </div>
      ) : cardsList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center max-w-md mx-auto shadow-2xs space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Lightbulb className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-gray-900">No inspiration ideas found</h4>
          <p className="text-xs text-gray-500">
            {selectedCategory !== 'All Categories' || showSavedOnly
              ? 'No ideas match your active filter. Try resetting category or saved filters.'
              : 'Your moodboard is currently empty. Click "Generate Ideas (AI)" to spark creative themes or add your own custom concepts.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateModalOpen(true)}
              className="text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Generate with Gemini
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddCard}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Idea
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cardsList.map((card) => (
            <InspirationCardItem
              key={card.id}
              card={card}
              onToggleSave={handleToggleSave}
              onEdit={handleOpenEditCard}
              onDelete={(c) => setDeletingCard(c)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Card Modal */}
      <InspirationCardModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        onSubmit={handleCardModalSubmit}
        card={editingCard}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* AI Generate Ideas Modal */}
      <GenerateInspirationModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerateIdeas}
        onSaveIdea={handleSaveGeneratedIdea}
        isGenerating={generateMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      {deletingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Remove Inspiration Card?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <strong className="text-gray-900">{deletingCard.title}</strong> from your moodboard?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setDeletingCard(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove Card'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
