import React, { useState, useCallback, useEffect, useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  config: {
    regex?: boolean;
    caseSensitive?: boolean;
    wholeWord?: boolean;
  };
  onConfigChange: (config: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }) => void;
  placeholder?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onSubmit?: (value: string) => void;
}

const SEARCH_HISTORY_KEY = 'loglayer_input_history';
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('[SearchInput] Failed to load history:', e);
  }
  return [];
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch (e) {
    console.warn('[SearchInput] Failed to save history:', e);
  }
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  config,
  onConfigChange,
  placeholder = "搜索...",
  onMouseEnter,
  onMouseLeave,
  onSubmit
}) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedValue = useRef<string>('');

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (value === '') {
      setShowHistory(history.length > 0);
    } else if (value !== lastSubmittedValue.current) {
      setShowHistory(false);
    }
  }, [value, history]);

  const submitSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    lastSubmittedValue.current = query;
    setHistory(prev => {
      const filtered = prev.filter(q => q !== query);
      const newHistory = [query, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return newHistory;
    });
    setHistoryIndex(-1);
    setShowHistory(false);
    
    if (onSubmit) {
      onSubmit(query);
    }
  }, [onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch(value);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      const historyItem = history[newIndex];
      if (historyItem !== undefined) {
        onChange(historyItem);
        setShowHistory(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const historyItem = history[newIndex];
        if (historyItem !== undefined) {
          onChange(historyItem);
          setShowHistory(false);
        }
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        onChange(lastSubmittedValue.current);
        setShowHistory(false);
      }
      return;
    }

    if (e.key === 'Escape') {
      setShowHistory(false);
      setHistoryIndex(-1);
      return;
    }

    if (historyIndex !== -1 && e.key.length === 1) {
      setHistoryIndex(-1);
    }
  }, [history, historyIndex, onChange, submitSearch, value]);

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    setHistoryIndex(-1);
    if (newValue === '') {
      setShowHistory(history.length > 0);
    }
  }, [onChange, history]);

  const handleHistorySelect = useCallback((item: string) => {
    onChange(item);
    lastSubmittedValue.current = item;
    setShowHistory(false);
    setHistoryIndex(-1);
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div 
      className="relative flex items-center w-full group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <input
        ref={inputRef}
        type="text"
        className="bg-primary border border-default px-2 py-1 pr-20 text-[11px] rounded text-primary w-full focus:outline-none focus:border-primary-color select-text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        onMouseDown={(e) => e.stopPropagation()}
        onFocus={() => value === '' && history.length > 0 && setShowHistory(true)}
        onBlur={() => setTimeout(() => setShowHistory(false), 150)}
      />
      
      {/* History dropdown */}
      {showHistory && history.length > 0 && (
        <div 
          className="absolute top-full left-0 right-0 mt-1 bg-dark-3 border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="py-1">
            {history.map((item, index) => (
              <div
                key={index}
                className={`px-3 py-1.5 text-[11px] cursor-pointer flex items-center justify-between ${
                  index === historyIndex ? 'bg-theme-input text-primary' : 'text-gray-400 hover:bg-theme-input'
                }`}
                onClick={() => handleHistorySelect(item)}
              >
                <span className="truncate font-mono">{item}</span>
                <span className="text-[9px] text-gray-600 shrink-0 ml-2">↑{index + 1}</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-1 border-t border-white/5 text-[9px] text-gray-600 flex justify-between">
            <span>↑↓ 导航</span>
            <span>Enter 确认</span>
          </div>
        </div>
      )}
      
      <div className="absolute right-1 flex items-center space-x-0.5 pointer-events-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onConfigChange({ ...config, caseSensitive: !config.caseSensitive }); }}
          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${config.caseSensitive ? 'bg-primary-color text-white' : 'text-muted hover:bg-hover'}`}
          title="区分大小写 (Alt+C)"
        >
          Aa
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onConfigChange({ ...config, wholeWord: !config.wholeWord }); }}
          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${config.wholeWord ? 'bg-primary-color text-white' : 'text-muted hover:bg-hover'}`}
          title="全字匹配 (Alt+W)"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onConfigChange({ ...config, regex: !config.regex }); }}
          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${config.regex ? 'bg-primary-color text-white' : 'text-muted'}`}
          title="使用正则表达式 (Alt+R)"
        >
          .*
        </button>
      </div>
    </div>
  );
};