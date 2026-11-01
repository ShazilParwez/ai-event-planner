import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const FallbackNotice: React.FC<{ source?: string }> = ({ source }) => {
  if (source === 'gemini') return null;

  return (
    <div className="bg-amber-50/80 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-lg text-xs flex items-center space-x-2">
      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
      <span>
        <strong>Autonomous Fallback Active:</strong> AI suggestions are currently running in{' '}
        <span className="font-semibold">{source || 'deterministic offline mode'}</span> ensuring 100% planning continuity.
      </span>
    </div>
  );
};

