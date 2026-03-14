
import React, { useRef, useEffect, useState, useCallback } from 'react';

const SEARCH_HISTORY_KEY = 'loglayer_find_history';
const MAX_HISTORY = 20;

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {}
  return [];
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch (e) {}
}

interface EditorFindWidgetProps {
  query: string;
  onQueryChange: (q: string) => void;
  config: { regex: boolean; caseSensitive: boolean; wholeWord?: boolean };
  onConfigChange: React.Dispatch<React.SetStateAction<{ regex: boolean; caseSensitive: boolean; wholeWord?: boolean }>>;
  matchCount: number;
  currentMatch: number;
  onNavigate: (direction: 'next' | 'prev') => void;
  onClose: () => void;
}

export const EditorFindWidget: React.FC<EditorFindWidgetProps> = ({
  query,
  onQueryChange,
  config,
  onConfigChange,
  matchCount,
  currentMatch,
  onNavigate,
  onClose
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(440);
  const [isResizing, setIsResizing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const lastSubmittedValue = useRef<string>('');
  const isInitialLoad = useRef(true); // 标记是否首次加载（Ctrl+F打开）

  useEffect(() => {
    const loaded = loadHistory();
    setHistory(loaded);

    // 如果有传入的 query（选中的文字），自动搜索并记录历史
    if (query && query.trim()) {
      lastSubmittedValue.current = query;
      const filtered = loaded.filter(item => item !== query);
      const newHistory = [query, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      setHistory(newHistory);
      onQueryChange(query);
      isInitialLoad.current = false;
    }
    // 没有选中文字，只打开搜索框，不自动搜索
    else {
      // 清空输入框，让用户自己输入
      onQueryChange('');
      isInitialLoad.current = false;
    }
  }, []);

  // 当开始输入时，重置历史索引，标记不再是最开始
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    isInitialLoad.current = false;
    onQueryChange(e.target.value);
    setHistoryIndex(-1);
  }, [onQueryChange]);

  const addToHistory = useCallback((q: string) => {
    if (!q.trim()) return;
    lastSubmittedValue.current = q;
    setHistory(prev => {
      const filtered = prev.filter(item => item !== q);
      const newHistory = [q, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return newHistory;
    });
    setHistoryIndex(-1);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 上下键切换历史（像终端一样，即使输入框有内容也可以切换）
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) {
        return;
      }
      const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
      setHistoryIndex(newIndex);
      const item = history[newIndex];
      if (item !== undefined) {
        onQueryChange(item);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const item = history[newIndex];
        if (item !== undefined) {
          onQueryChange(item);
        }
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        onQueryChange('');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onNavigate('prev');
      } else {
        addToHistory(query);
        onNavigate('next');
      }
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Tab' && showHistory) {
      e.preventDefault();
      if (e.shiftKey) {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          onQueryChange(history[newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          onQueryChange(lastSubmittedValue.current);
        }
      } else {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        const item = history[newIndex];
        if (item !== undefined) {
          onQueryChange(item);
        }
      }
    }
  };

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(window.innerWidth * 0.8, startWidth + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [width]);

  return (
    <div
      ref={widgetRef}
      style={{ width: `${width}px` }}
      className={`absolute top-2 right-8 z-30 bg-dark-1 border border-theme-default rounded flex items-center shadow-2xl p-1 space-x-1 animate-in slide-in-from-top-2 duration-150 select-none ${isResizing ? 'ring-1 ring-blue-500/50' : ''}`}
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-500/30 transition-colors z-40 group"
        title="拖动调整宽度"
      >
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[1px] h-4 bg-gray-600 group-hover:bg-blue-400" />
      </div>

      <div className="flex-1 flex items-center bg-theme-input border border-blue-500/30 rounded overflow-hidden ml-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query === '' && history.length > 0 && setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          placeholder="查找"
          className="bg-transparent text-white text-xs px-2 py-1 w-full focus:outline-none select-text"
        />
        
        {showHistory && history.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-dark-2 border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
            <div className="py-1">
              {history.map((item, index) => (
                <div
                  key={index}
                  className={`px-3 py-1.5 text-xs cursor-pointer flex items-center justify-between ${
                    index === historyIndex ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-theme-input'
                  }`}
                  onClick={() => { onQueryChange(item); lastSubmittedValue.current = item; setShowHistory(false); }}
                >
                  <span className="truncate font-mono">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center pr-1 bg-theme-input shrink-0">
          <button
            onClick={() => onConfigChange(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
            className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${config.caseSensitive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#555]'}`}
            title="区分大小写 (Alt+C)"
          >
            Aa
          </button>
          <button
            onClick={() => onConfigChange(prev => ({ ...prev, wholeWord: !prev.wholeWord }))}
            className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${config.wholeWord ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#555]'}`}
            title="全字匹配 (Alt+W)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <button
            onClick={() => onConfigChange(prev => ({ ...prev, regex: !prev.regex }))}
            className={`w-5 h-5 flex items-center justify-center rounded text-[10px] transition-colors ${config.regex ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#555]'}`}
            title="使用正则表达式 (Alt+R)"
          >
            .*
          </button>
        </div>
      </div>

      <div className="flex items-center px-2 border-r border-white/10 text-[10px] text-gray-500 font-mono min-w-[70px] justify-center shrink-0 select-none">
        {matchCount > 0 ? `${currentMatch} / ${matchCount}` : '无结果'}
      </div>

      <div className="flex items-center shrink-0 select-none">
        <button
          onClick={() => {
            console.log('[EditorFindWidget] Prev button clicked, calling onNavigate');
            onNavigate?.('prev');
          }}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-theme-input rounded transition-colors"
          title="上一个匹配项 (Shift+Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
        </button>
        <button
          onClick={() => {
            console.log('[EditorFindWidget] Next button clicked, calling onNavigate');
            onNavigate?.('next');
          }}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-theme-input rounded transition-colors"
          title="下一个匹配项 (Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-theme-input rounded transition-colors ml-1"
          title="关闭 (Escape)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};
