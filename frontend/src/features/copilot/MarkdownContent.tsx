import React from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className = '',
}) => {
  // Simple, safe markdown parser that avoids unsafe innerHTML
  const lines = content.split('\n');

  const renderFormattedText = (text: string): React.ReactNode => {
    // Process bold text **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      // Process inline code `code`
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((subpart, subIndex) => {
        if (subpart.startsWith('`') && subpart.endsWith('`')) {
          return (
            <code
              key={`${index}-${subIndex}`}
              className="bg-slate-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-mono font-medium"
            >
              {subpart.slice(1, -1)}
            </code>
          );
        }
        return subpart;
      });
    });
  };

  return (
    <div className={`space-y-2 text-sm text-slate-800 leading-relaxed ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Headings
        if (trimmed.startsWith('### ')) {
          return (
            <h4
              key={idx}
              className="text-sm font-bold text-slate-900 mt-3 mb-1 tracking-tight flex items-center"
            >
              {renderFormattedText(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3
              key={idx}
              className="text-base font-bold text-slate-900 mt-3.5 mb-1 tracking-tight"
            >
              {renderFormattedText(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-slate-900 mt-4 mb-1.5 tracking-tight"
            >
              {renderFormattedText(trimmed.slice(2))}
            </h2>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-purple-600 font-bold mt-0.5 select-none">•</span>
              <span className="flex-1">{renderFormattedText(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-purple-600 font-semibold text-xs mt-0.5 min-w-[1.2rem] select-none">
                {numberedMatch[1]}.
              </span>
              <span className="flex-1">
                {renderFormattedText(numberedMatch[2] || '')}
              </span>
            </div>
          );
        }

        // Standard paragraph
        return <p key={idx}>{renderFormattedText(line)}</p>;
      })}
    </div>
  );
};
