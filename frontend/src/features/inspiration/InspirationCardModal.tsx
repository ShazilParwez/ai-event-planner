import React, { useState, useEffect } from 'react';
import { X, Sparkles, Tag, Palette, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  InspirationCard,
  InspirationCardCreatePayload,
  InspirationCardUpdatePayload,
  InspirationCategory,
} from '@/types/inspiration';

interface InspirationCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InspirationCardCreatePayload | InspirationCardUpdatePayload) => Promise<void>;
  card?: InspirationCard | null;
  isLoading?: boolean;
}

const CATEGORIES: InspirationCategory[] = [
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

export const InspirationCardModal: React.FC<InspirationCardModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  card,
  isLoading = false,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Decorations');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [colorPaletteInput, setColorPaletteInput] = useState('');
  const [suggestedBudgetRange, setSuggestedBudgetRange] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setCategory(card.category || 'Decorations');
      setDescription(card.description || '');
      setTags(card.tags || '');
      setColorPaletteInput(card.color_palette ? card.color_palette.join(', ') : '');
      setSuggestedBudgetRange(card.suggested_budget_range || '');
      setNotes(card.notes || '');
      setIsSaved(card.is_saved ?? true);
    } else {
      setTitle('');
      setCategory('Decorations');
      setDescription('');
      setTags('');
      setColorPaletteInput('#FF9933, #D4AF37, #800020');
      setSuggestedBudgetRange('₹50,000 - ₹1,00,000 (Indicative)');
      setNotes('');
      setIsSaved(true);
    }
    setError(null);
  }, [card, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    const palette = colorPaletteInput
      ? colorPaletteInput.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    try {
      setError(null);
      await onSubmit({
        title: title.trim(),
        category,
        description: description.trim(),
        tags: tags.trim() || null,
        color_palette: palette.length > 0 ? palette : null,
        suggested_budget_range: suggestedBudgetRange.trim() || null,
        notes: notes.trim() || null,
        is_saved: isSaved,
        is_ai_generated: card?.is_ai_generated ?? false,
        source_type: card?.source_type ?? 'USER',
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save inspiration card.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {card ? 'Edit Inspiration Idea' : 'Add Inspiration Card'}
              </h3>
              <p className="text-xs text-gray-500">
                Curate moodboards, theme aesthetics, color swatches, and indicative cost ranges.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Title & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="card-title-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Idea Title <span className="text-red-500">*</span>
              </label>
              <Input
                id="card-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Royal Marigold Canopy with Urlis"
                required
              />
            </div>

            <div>
              <label htmlFor="card-category-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Category
              </label>
              <select
                id="card-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="card-desc-input" className="block text-xs font-semibold text-gray-700 mb-1">
              Creative Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="card-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the aesthetic concept, materials, textures, ambiance, or arrangement..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Color Palette (Comma-separated Hex Codes) */}
          <div>
            <label htmlFor="card-palette-input" className="block text-xs font-semibold text-gray-700 mb-1">
              Color Palette (Comma-separated Hex Codes)
            </label>
            <div className="relative">
              <Palette className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <input
                id="card-palette-input"
                type="text"
                value={colorPaletteInput}
                onChange={(e) => setColorPaletteInput(e.target.value)}
                placeholder="#FF9933, #D4AF37, #800020, #FFFDD0"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Tags & Suggested Budget Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="card-tags-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Theme Tags
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="card-tags-input"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="decor, lighting, royal, traditional"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="card-budget-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Indicative Budget Range
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  id="card-budget-input"
                  type="text"
                  value={suggestedBudgetRange}
                  onChange={(e) => setSuggestedBudgetRange(e.target.value)}
                  placeholder="e.g. ₹60,000 - ₹1,20,000 (Indicative)"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Note: Ranges are indicative estimates, not confirmed vendor quotes.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="card-notes-input" className="block text-xs font-semibold text-gray-700 mb-1">
              Private Notes
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
              <input
                id="card-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Logistics notes, vendor ideas, specific requirements..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Saved to Moodboard Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="card-is-saved"
              checked={isSaved}
              onChange={(e) => setIsSaved(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
            />
            <label htmlFor="card-is-saved" className="text-xs font-medium text-gray-700 cursor-pointer">
              Save to Active Event Moodboard
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Saving...' : card ? 'Update Idea' : 'Save to Moodboard'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

