import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Palette,
  Check,
  AlertCircle,
  BookmarkPlus,
  BookmarkCheck,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  GeneratedIdea,
  InspirationCategory,
  InspirationCardCreatePayload,
} from '@/types/inspiration';

interface GenerateInspirationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: {
    category?: string | null;
    custom_prompt?: string | null;
    num_ideas?: number;
  }) => Promise<{ ideas: GeneratedIdea[]; disclaimer: string }>;
  onSaveIdea: (idea: InspirationCardCreatePayload) => Promise<void>;
  isGenerating?: boolean;
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
];

export const GenerateInspirationModal: React.FC<GenerateInspirationModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  onSaveIdea,
  isGenerating = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [customPrompt, setCustomPrompt] = useState('');
  const [numIdeas, setNumIdeas] = useState(4);
  const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([]);
  const [savedIdeaIndices, setSavedIdeaIndices] = useState<Set<number>>(new Set());
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleGenerateClick = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setGeneratedIdeas([]);
      setSavedIdeaIndices(new Set());
      const res = await onGenerate({
        category: selectedCategory !== 'All Categories' ? selectedCategory : null,
        custom_prompt: customPrompt.trim() || null,
        num_ideas: numIdeas,
      });
      setGeneratedIdeas(res.ideas || []);
      setDisclaimer(res.disclaimer);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to generate inspiration ideas.');
      }
    }
  };

  const handleSaveSingleIdea = async (idea: GeneratedIdea, index: number) => {
    try {
      setSavingIndex(index);
      await onSaveIdea({
        title: idea.title,
        category: idea.category,
        description: idea.description,
        tags: idea.tags.join(', '),
        color_palette: idea.color_palette,
        suggested_budget_range: idea.suggested_budget_range,
        is_saved: true,
        is_ai_generated: true,
        source_type: 'AI_GENERATED',
      });
      setSavedIdeaIndices((prev) => new Set(prev).add(index));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save idea.');
      }
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      for (let i = 0; i < generatedIdeas.length; i++) {
        const idea = generatedIdeas[i];
        if (idea && !savedIdeaIndices.has(i)) {
          await handleSaveSingleIdea(idea, i);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                AI Inspiration Studio Generator
              </h3>
              <p className="text-xs text-gray-500">
                Generate curated creative concepts, color swatches, and indicative budgets powered by Gemini.
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

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleGenerateClick} className="bg-purple-50/40 p-4 rounded-xl border border-purple-100 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gen-category-select" className="block text-xs font-semibold text-gray-700 mb-1">
                  Focus Category
                </label>
                <select
                  id="gen-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="gen-count-select" className="block text-xs font-semibold text-gray-700 mb-1">
                  Number of Ideas
                </label>
                <select
                  id="gen-count-select"
                  value={numIdeas}
                  onChange={(e) => setNumIdeas(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value={3}>3 Ideas</option>
                  <option value={4}>4 Ideas</option>
                  <option value={5}>5 Ideas</option>
                  <option value={6}>6 Ideas</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="gen-prompt-input" className="block text-xs font-semibold text-gray-700 mb-1">
                Custom Aesthetic / Prompt (Optional)
              </label>
              <input
                id="gen-prompt-input"
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Royal Rajasthani Palace, candlelit courtyards, vibrant sangeet stage"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-gray-500">
                Bounded 15s deadline with autonomous fallback failover.
              </p>
              <Button
                type="submit"
                variant="primary"
                disabled={isGenerating}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Ideas...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Ideas</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Generated Ideas Review Section */}
          {generatedIdeas.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Review Generated Ideas ({generatedIdeas.length})
                  </h4>
                  <p className="text-xs text-gray-500">
                    Review candidate ideas and choose which ones to save to your live event moodboard.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={savedIdeaIndices.size === generatedIdeas.length}
                  className="flex items-center gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>
                    {savedIdeaIndices.size === generatedIdeas.length
                      ? 'All Saved to Moodboard'
                      : 'Save All to Moodboard'}
                  </span>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedIdeas.map((idea, idx) => {
                  const isSaved = savedIdeaIndices.has(idx);
                  const isSavingThis = savingIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        isSaved
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {idea.category}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSaved || isSavingThis}
                          onClick={() => handleSaveSingleIdea(idea, idx)}
                          className={`text-xs px-2 py-1 h-auto flex items-center gap-1 ${
                            isSaved
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-purple-700 hover:bg-purple-50'
                          }`}
                        >
                          {isSaved ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Saved</span>
                            </>
                          ) : isSavingThis ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3 h-3" />
                              <span>Save to Moodboard</span>
                            </>
                          )}
                        </Button>
                      </div>

                      <h5 className="font-bold text-gray-900 text-sm leading-snug">{idea.title}</h5>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-3">
                        {idea.description}
                      </p>

                      {/* Color Palette */}
                      {idea.color_palette && idea.color_palette.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <Palette className="w-3 h-3 text-gray-400" />
                          {idea.color_palette.map((hex, pIdx) => (
                            <div
                              key={pIdx}
                              className="w-4 h-4 rounded-full border border-gray-300 shadow-2xs"
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                        </div>
                      )}

                      {/* Indicative Budget Tag */}
                      {idea.suggested_budget_range && (
                        <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-200/60 inline-block font-medium">
                          {idea.suggested_budget_range}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {disclaimer && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-[11px] text-gray-500 italic">
                  Note: {disclaimer}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-100">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
