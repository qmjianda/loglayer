import React, { useCallback, useRef } from 'react';

export interface TextInputWithOptionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Show/hide option buttons (default: all show)
  showCaseSensitive?: boolean;
  showWholeWord?: boolean;
  showRegex?: boolean;
  // Current config state
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  // Config change handler
  onConfigChange?: (config: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean }) => void;
  // Optional key handler
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Optional className
  className?: string;
}

export const TextInputWithOptions: React.FC<TextInputWithOptionsProps> = ({
  value,
  onChange,
  placeholder = '',
  showCaseSensitive = true,
  showWholeWord = true,
  showRegex = true,
  caseSensitive = false,
  wholeWord = false,
  regex = false,
  onConfigChange,
  onKeyDown,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleConfigToggle = useCallback((key: 'caseSensitive' | 'wholeWord' | 'regex') => {
    if (!onConfigChange) return;
    onConfigChange({
      caseSensitive: key === 'caseSensitive' ? !caseSensitive : caseSensitive,
      wholeWord: key === 'wholeWord' ? !wholeWord : wholeWord,
      regex: key === 'regex' ? !regex : regex,
    });
  }, [onConfigChange, caseSensitive, wholeWord, regex]);

  const hasOptions = showCaseSensitive || showWholeWord || showRegex;

  return (
    <div className={`relative flex items-center w-full group ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="bg-primary border border-default px-2 py-1 text-[11px] rounded text-primary w-full focus:outline-none focus:border-primary-color select-text pr-20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
      />

      {hasOptions && (
        <div className="absolute right-1 flex items-center space-x-0.5 pointer-events-auto">
          {showCaseSensitive && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConfigToggle('caseSensitive'); }}
              className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${
                caseSensitive ? 'bg-primary-color text-white' : 'text-muted hover:bg-hover'
              }`}
              title="区分大小写"
            >
              Aa
            </button>
          )}
          {showWholeWord && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConfigToggle('wholeWord'); }}
              className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${
                wholeWord ? 'bg-primary-color text-white' : 'text-muted hover:bg-hover'
              }`}
              title="全词匹配"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2.5" d="M3 12h18M3 6h18M3 18h18"/>
              </svg>
            </button>
          )}
          {showRegex && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConfigToggle('regex'); }}
              className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${
                regex ? 'bg-primary-color text-white' : 'text-muted hover:bg-hover'
              }`}
              title="正则表达式"
            >
              .*
            </button>
          )}
        </div>
      )}
    </div>
  );
};