import React, { useRef, useEffect, useState, useCallback } from 'react';

export type SearchMode = 'highlight' | 'filter';

interface EditorFindWidgetProps {
  /** 所属面板 id（dockview panelId），宿主据此读写 store per-tab 状态 */
  panelId: string;
  /** 本面板是否激活：非激活时 widget 淡显且不可交互 */
  isActive: boolean;
  /** Ctrl+F 聚焦请求计数：变化（含首帧）时 focus 输入框并全选 */
  focusRequest: number;
  query: string;
  onQueryChange: (q: string) => void;
  config: { regex: boolean; caseSensitive: boolean; wholeWord?: boolean };
  onConfigChange: React.Dispatch<
    React.SetStateAction<{ regex: boolean; caseSensitive: boolean; wholeWord?: boolean }>
  >;
  matchCount: number;
  currentMatch: number;
  onNavigate: (direction: 'next' | 'prev') => void;
  onClose: () => void;
  searchMode?: SearchMode;
  onSearchModeChange?: (mode: SearchMode) => void;
}

const INITIAL_WIDTH = 419;
const MIN_WIDTH = 419;

export const EditorFindWidget: React.FC<EditorFindWidgetProps> = ({
  panelId,
  isActive,
  focusRequest,
  query,
  onQueryChange,
  config,
  onConfigChange,
  matchCount,
  currentMatch,
  onNavigate,
  onClose,
  searchMode = 'highlight',
  onSearchModeChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(INITIAL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const lastFocusRequestRef = useRef<number>(focusRequest);

  // 挂载即聚焦（Ctrl+F 打开语义）；面板非激活时不抢焦点
  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // focusRequest 递增（Ctrl+F 重复按下）：focus + select 全选已有词
  useEffect(() => {
    if (focusRequest === lastFocusRequestRef.current) return;
    lastFocusRequestRef.current = focusRequest;
    if (isActive) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusRequest, isActive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onNavigate(e.shiftKey ? 'prev' : 'next');
    } else if (e.key === 'Escape') {
      // Esc 第一段：收起查找条并保留搜索词/高亮（VSCode 语义）；stopPropagation 阻止全局第二段处理
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.max(MIN_WIDTH, startWidth + delta);
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [width]
  );

  // 双击把手：最大化至面板可用宽度
  const maximizeWidth = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.currentTarget as HTMLElement).closest('[data-find-widget-host]') as HTMLElement | null;
    const maxWidth = container ? Math.max(MIN_WIDTH, container.clientWidth - 40) : MIN_WIDTH;
    setWidth(maxWidth);
  }, []);

  const toggleSearchMode = () => {
    if (onSearchModeChange) {
      onSearchModeChange(searchMode === 'highlight' ? 'filter' : 'highlight');
    }
  };

  const hasError = query.trim().length > 0 && matchCount === 0;

  return (
    <div
      ref={(el) => {
        if (el) el.dataset.findWidgetPanel = panelId;
      }}
      style={{ width: `${width}px` }}
      className={`absolute top-2 right-8 z-30 bg-theme-surface border border-theme-default rounded-lg flex items-center shadow-2xl p-1 space-x-1 animate-in slide-in-from-top-2 duration-150 select-none ${
        isResizing ? 'ring-1 ring-blue-500/50' : ''
      } ${isActive ? '' : 'pointer-events-none opacity-40'}`}
    >
      {/* Resizer Handle (双击最大化) */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={maximizeWidth}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-500/30 transition-colors z-40 group"
        title="拖动调整宽度，双击最大化"
      >
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[1px] h-4 bg-theme-muted group-hover:bg-blue-400" />
      </div>

      {/* Search Mode Toggle */}
      {onSearchModeChange && (
        <button
          onClick={toggleSearchMode}
          className={`ml-1 px-2 py-1 rounded text-[9px] font-medium tracking-wide transition-all shrink-0 ${
            searchMode === 'filter' ? 'bg-primary-color text-white' : 'bg-theme-input text-theme-secondary hover:text-theme-primary'
          }`}
          title={searchMode === 'highlight' ? '当前: 仅高亮模式。点击切换到过滤模式' : '当前: 过滤模式（隐藏不匹配行）。点击切换到仅高亮模式'}
        >
          {searchMode === 'filter' ? '过滤' : '高亮'}
        </button>
      )}

      <div
        className={`flex-1 flex items-center bg-theme-input border rounded overflow-hidden ml-1 transition-colors ${
          hasError ? 'border-red-500' : isFocused ? 'border-theme-focus' : 'border-theme-default'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="查找"
          className="bg-transparent text-theme-primary text-xs px-2 py-1 min-h-[25px] w-full focus:outline-none select-text"
        />

        <div className="flex items-center pr-1 bg-theme-input shrink-0">
          <button
            onClick={() => onConfigChange((prev) => ({ ...prev, caseSensitive: !prev.caseSensitive }))}
            className={`w-[22px] h-[22px] flex items-center justify-center rounded text-[10px] transition-colors ${
              config.caseSensitive ? 'bg-primary-color text-white' : 'text-theme-secondary hover:bg-theme-hover'
            }`}
            title="区分大小写 (Alt+C)"
          >
            Aa
          </button>
          <button
            onClick={() => onConfigChange((prev) => ({ ...prev, wholeWord: !prev.wholeWord }))}
            className={`w-[22px] h-[22px] flex items-center justify-center rounded text-[10px] transition-colors ${
              config.wholeWord ? 'bg-primary-color text-white' : 'text-theme-secondary hover:bg-theme-hover'
            }`}
            title="全字匹配 (Alt+W)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2.5" d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <button
            onClick={() => onConfigChange((prev) => ({ ...prev, regex: !prev.regex }))}
            className={`w-[22px] h-[22px] flex items-center justify-center rounded text-[10px] transition-colors ${
              config.regex ? 'bg-primary-color text-white' : 'text-theme-secondary hover:bg-theme-hover'
            }`}
            title="使用正则表达式 (Alt+R)"
          >
            .*
          </button>
        </div>
      </div>

      <div
        className={`flex items-center px-2 border-r border-theme-subtle text-[10px] font-mono min-w-[69px] justify-center shrink-0 select-none ${
          hasError ? 'text-error' : 'text-theme-secondary'
        }`}
      >
        {hasError ? '无结果' : matchCount > 0 ? `${currentMatch} / ${matchCount}` : '0 / 0'}
      </div>

      <div className="flex items-center shrink-0 select-none">
        <button
          onClick={() => onNavigate('prev')}
          className="w-[22px] h-[22px] flex items-center justify-center text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded transition-colors"
          title="上一个匹配项 (Shift+Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => onNavigate('next')}
          className="w-[22px] h-[22px] flex items-center justify-center text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded transition-colors"
          title="下一个匹配项 (Enter)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          onClick={onClose}
          className="w-[22px] h-[22px] flex items-center justify-center text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded transition-colors ml-1"
          title="关闭 (Escape)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
