import React from 'react';
import { Bookmark, Sparkles, User, Tag, Edit2, Trash2, Info } from 'lucide-react';
import { InspirationCard } from '@/types/inspiration';

interface InspirationCardItemProps {
  card: InspirationCard;
  onToggleSave: (cardId: string) => void;
  onEdit: (card: InspirationCard) => void;
  onDelete: (card: InspirationCard) => void;
}

export const InspirationCardItem: React.FC<InspirationCardItemProps> = ({
  card,
  onToggleSave,
  onEdit,
  onDelete,
}) => {
  const isAIGenerated = card.is_ai_generated || card.source_type === 'AI_GENERATED';
  const tagsList = card.tags
    ? card.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md ${
        card.is_saved ? 'border-amber-200/80 ring-1 ring-amber-100' : 'border-gray-200'
      }`}
    >
      <div className="p-5 space-y-3.5">
        {/* Header: Category & Save Bookmark */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {card.category}
            </span>

            {isAIGenerated ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                <Sparkles className="w-3 h-3 text-purple-600" />
                AI Generated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                <User className="w-3 h-3 text-gray-500" />
                Curated
              </span>
            )}
          </div>

          <button
            onClick={() => onToggleSave(card.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              card.is_saved
                ? 'text-amber-500 hover:text-amber-600 bg-amber-50'
                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
            }`}
            title={card.is_saved ? 'Saved to moodboard' : 'Click to save to moodboard'}
          >
            <Bookmark className={`w-4 h-4 ${card.is_saved ? 'fill-amber-500' : ''}`} />
          </button>
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-snug">{card.title}</h3>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-3">
            {card.description}
          </p>
        </div>

        {/* Color Palette Swatches */}
        {card.color_palette && card.color_palette.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-gray-400 font-medium">Color Palette</p>
            <div className="flex items-center gap-1.5">
              {card.color_palette.map((hex, idx) => (
                <div
                  key={idx}
                  className="group relative w-6 h-6 rounded-full border border-gray-200 shadow-2xs cursor-help transition-transform hover:scale-110"
                  style={{ backgroundColor: hex }}
                  title={hex}
                >
                  <span className="hidden group-hover:block absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1 py-0.5 rounded whitespace-nowrap z-10 shadow-sm">
                    {hex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tagsList.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {tagsList.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100"
              >
                <Tag className="w-2.5 h-2.5 text-gray-400" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Notes if present */}
        {card.notes && (
          <div className="p-2 bg-gray-50 rounded-lg text-[11px] text-gray-500 italic">
            "{card.notes}"
          </div>
        )}
      </div>

      {/* Footer: Budget Range Tag & Actions */}
      <div className="px-5 py-3 bg-gray-50/75 border-t border-gray-100 flex items-center justify-between gap-2">
        {card.suggested_budget_range ? (
          <div
            className="flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200/60 max-w-[200px] truncate"
            title="Indicative estimate based on industry benchmarks; not a confirmed vendor quote."
          >
            <span className="truncate">{card.suggested_budget_range}</span>
            <Info className="w-3 h-3 text-emerald-600 shrink-0" />
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(card)}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Edit card"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(card)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete card"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

