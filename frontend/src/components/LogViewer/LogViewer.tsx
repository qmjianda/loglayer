/**
 * LogViewer - Canvas-based Redesign (Refactored)
 *
 * Performance Optimized: Uses HTML5 Canvas for rendering millions of lines.
 * Hybrid Scroll: Native OS scrolling with Canvas drawing.
 * High-DPI: Sharp rendering on all displays.
 *
 * This component is now an orchestrator that integrates:
 * - useLogViewerState: State management
 * - useCanvasDimensions: Viewport sizing
 * - useScrollLogic: Scroll calculations
 * - useSelection: Text selection handling
 * - useLineFetcher: Lazy data loading
 * - useCanvasDraw: Canvas rendering
 * - Widget components: ContextMenu, JsonExpandedViewer, PerformancePanel
 *
 * Original file: 1180 lines -> Refactored: ~250 lines
 */

import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { LayerType } from '../../types';
import { LOG_VIEWER } from '../../constants';
import { getLogViewerColors } from '../../theme';
import { AppSettings } from '../../hooks/useSettings';
import { detectJson } from '../../utils/jsonTree';
import { useShortcut } from '../../shortcuts';

import { useLogViewerState, LogLine as HookLogLine } from './hooks/useLogViewerState';
import { useCanvasDimensions } from './hooks/useCanvasDimensions';
import { useScrollLogic } from './hooks/useScrollLogic';
import { useSelection } from './hooks/useSelection';
import { useLineFetcher } from './hooks/useLineFetcher';
import { createTextMeasurer } from './utils/measureText';

// Canvas components
import { CanvasRenderer } from './canvas/CanvasRenderer';
import { useCanvasDraw } from './canvas/useCanvasDraw';

// Widget components
import { ContextMenu } from './widgets/ContextMenu';
import { JsonExpandedViewer } from './widgets/JsonExpandedViewer';
import { PerformancePanel } from './widgets/PerformancePanel';

// Existing components
import { BookmarkPopover } from '../BookmarkPopover';
import { EditorGoToLineWidget } from '../EditorGoToLineWidget';
import { ErrorBoundary } from '../ErrorBoundary';

/**
 * LogViewer Props - Keeping backward compatibility
 * This interface MUST remain unchanged for external consumers
 */
export interface LogViewerProps {
  totalLines: number;
  fileId: string | null;
  paneId?: string;
  searchQuery: string;
  searchConfig: { regex: boolean; caseSensitive: boolean; wholeWord?: boolean };
  scrollToIndex?: number | null;
  highlightedIndex?: number | null;
  isSearching?: boolean;
  isIndexing?: boolean;
  indexingProgress?: number;
  onLineClick?: (index: number) => void;
  onAddLayer?: (type: LayerType, config?: any) => void;
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void;
  onToggleBookmark?: (lineIndex: number) => void;
  onUpdateBookmarkComment?: (lineIndex: number, comment: string) => void;
  onSelectedTextChange?: (text: string) => void;
  updateTrigger?: number;
  layerStats?: Record<string, { count: number, distribution: number[] }>;
  bookmarks?: Record<number, string>;
  settings?: AppSettings;
  resolvedTheme?: 'dark' | 'light';
  hasNewContent?: boolean;
  onScrollToNewContent?: () => void;
}

/**
 * LogViewer Component
 * 
 * Canvas-based log viewer with virtual scrolling for millions of lines.
 * Delegates all logic to specialized hooks and components.
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  totalLines,
  fileId,
  paneId,
  scrollToIndex,
  highlightedIndex = null,
  isSearching = false,
  isIndexing = false,
  indexingProgress = 0,
  onLineClick,
  onAddLayer,
  onVisibleRangeChange,
  onToggleBookmark,
  onUpdateBookmarkComment,
  onSelectedTextChange,
  updateTrigger,
  layerStats = {},
  bookmarks = {},
  settings,
  resolvedTheme = 'dark',
  hasNewContent = false,
  onScrollToNewContent
}) => {
  // ========== Refs ==========
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const charWidthRef = useRef(LOG_VIEWER.CHAR_WIDTH_DEFAULT);

  // ========== State Management ==========
  const { state, actions, refs } = useLogViewerState();
  const { lastFetchRef, scrollVelocityRef, scrollDirectionRef, lastScrollTimeRef, lastScrollTopRef } = refs;

  // ========== Settings ==========
  const fontSize = settings?.fontSize ?? 12;
  const lineHeight = settings?.lineHeight ?? LOG_VIEWER.LINE_HEIGHT;
  const wordWrap = settings?.wordWrap ?? false;
  const showWhitespace = settings?.showWhitespace ?? false;
  const showLineNumbers = settings?.showLineNumbers ?? true;
  const virtualScrollBufferSetting = settings?.virtualScrollBuffer ?? 500;
  const searchHighlightAll = settings?.searchHighlightAll ?? true;
  const theme = resolvedTheme ?? 'dark';

  const gutterWidth = LOG_VIEWER.GUTTER_WIDTH;
  const font = useMemo(() => 
    `${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`, 
    [fontSize]
  );

  // ========== Theme Colors ==========
  const colors = useMemo(() => getLogViewerColors(theme as 'dark' | 'light'), [theme]);

  // ========== Text Measurer ==========
  const textMeasurer = useMemo(() => createTextMeasurer(font), [font]);

  const measureSubstringWidth = useCallback(
    (text: string, start: number, end: number): number => 
      textMeasurer.measureSubstringWidth(text, start, end),
    [textMeasurer]
  );

  const charIndexFromX = useCallback(
    (text: string, xOffset: number): number => 
      textMeasurer.charIndexFromX(text, xOffset),
    [textMeasurer]
  );

  // ========== Initialize Text Measurement ==========
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = font;
      const testStr = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      charWidthRef.current = ctx.measureText(testStr).width / testStr.length;
      measureCtxRef.current = ctx;
    }
  }, [font]);

  // ========== Derived Values ==========
  const realTotalHeight = useMemo(() => totalLines * lineHeight, [totalLines, lineHeight]);
  const useScrollScaling = useMemo(() => realTotalHeight > LOG_VIEWER.VIRTUAL_HEIGHT_LIMIT, [realTotalHeight]);
  const baseBuffer = useScrollScaling ? LOG_VIEWER.BUFFER_LARGE : LOG_VIEWER.BUFFER_NORMAL;
  const velocityBuffer = Math.abs(scrollVelocityRef.current) * 200;
  const directionBonus = scrollDirectionRef.current === 'down' ? 500 : 0;
  const dynamicBuffer = useMemo(() => 
    Math.floor(Math.min(virtualScrollBufferSetting, baseBuffer + velocityBuffer + directionBonus)),
    [virtualScrollBufferSetting, baseBuffer, velocityBuffer, directionBonus]
  );
  const virtualTotalHeight = useMemo(() => 
    (useScrollScaling ? LOG_VIEWER.VIRTUAL_HEIGHT_LIMIT : realTotalHeight) + LOG_VIEWER.SCROLL_MARGIN,
    [useScrollScaling, realTotalHeight]
  );

  // ========== Canvas Dimensions ==========
  useCanvasDimensions({
    containerRef,
    setViewportWidth: actions.setViewportWidth,
    setViewportHeight: actions.setViewportHeight,
  });

  // ========== Scroll Logic ==========
  const { computed: scrollComputed, updateScrollVelocity } = useScrollLogic({
    scrollTop: state.scrollTop,
    viewportHeight: state.viewportHeight,
    viewportWidth: state.viewportWidth,
    totalLines,
    lineHeight,
    buffer: dynamicBuffer,
    useScrollScaling,
    virtualTotalHeight,
    realTotalHeight,
    containerRef,
    scrollVelocityRef,
    scrollDirectionRef,
    lastScrollTimeRef,
    lastScrollTopRef,
  });

  const { maxPhysicalScroll, maxLogicalScroll, effectiveScrollTop, startIndex, endIndex } = scrollComputed;

    // ========== Line Fetcher ==========
  useLineFetcher({
    fileId,
    totalLines,
    startIndex,
    endIndex,
    updateTrigger,
    maxLineWidth: state.maxLineWidth,
    measureCtxRef,
    charWidthRef,
    gutterWidth,
    lastFetchRef,
    setBridgedLines: actions.setBridgedLines,
    setMaxLineWidth: actions.setMaxLineWidth,
  });

  useEffect(() => {
    if (bookmarks && Object.keys(bookmarks).length > 0) {
      actions.updateBookmarks(bookmarks);
    }
  }, [bookmarks, actions.updateBookmarks]);

  // ========== Selection Handling ==========
  const { getPosFromEvent, handleMouseDown, handleDoubleClick } = useSelection({
    containerRef,
    lineHeight,
    gutterWidth,
    scrollLeft: state.scrollLeft,
    totalLines,
    bridgedLines: state.bridgedLines,
    charIndexFromX,
    effectiveScrollTop,
    selection: state.selection,
    setSelection: actions.setSelection,
    isSelecting: state.isSelecting,
    setIsSelecting: actions.setIsSelecting,
    hoveredLineIndex: state.hoveredLineIndex,
    setHoveredLineIndex: actions.setHoveredLineIndex,
    highlightedIndex,
    onLineClick,
    onSelectedTextChange,
    setHighlightedWord: actions.setHighlightedWord,
  });

  // ========== Canvas Drawing ==========
  const { draw } = useCanvasDraw({
    canvasRef,
    containerRef,
    viewportWidth: state.viewportWidth,
    viewportHeight: state.viewportHeight,
    startIndex,
    endIndex,
    scrollTop: state.scrollTop,
    scrollLeft: state.scrollLeft,
    bridgedLines: state.bridgedLines as Map<number, string | {
      index: number;
      content: string;
      displayContent?: string;
      highlights?: Array<{ start: number; end: number; color: string; opacity: number; isSearch?: boolean }>;
      isMarked?: boolean;
      bookmarkComment?: string;
      rowStyle?: { backgroundColor?: string; color?: string };
    }>,
    totalLines,
    selection: state.selection,
    isSelecting: state.isSelecting,
    highlightedIndex,
    hoveredLineIndex: state.hoveredLineIndex,
    lineHeight,
    font,
    fontSize,
    charWidthRef,
    showLineNumbers,
    wordWrap,
    showWhitespace,
    gutterWidth,
    colors,
    searchHighlightAll,
    highlightedWord: state.highlightedWord || '',
    useScrollScaling,
    maxPhysicalScroll,
    maxLogicalScroll,
    isIndexing,
    isSearching,
    indexingProgress,
    jumpPulseIndex: state.jumpPulseIndex,
    onPerformanceStatsUpdate: actions.setPerformanceStats,
    measureSubstringWidth,
  });

  // ========== Scroll to Index Effect ==========
  useEffect(() => {
    if (scrollToIndex !== null && scrollToIndex !== undefined && containerRef.current) {
      const targetLogicalScroll = Math.max(0, scrollToIndex * lineHeight - (state.viewportHeight / 3));
      const targetPhysicalScroll = useScrollScaling && maxLogicalScroll > 0
        ? (targetLogicalScroll / maxLogicalScroll) * maxPhysicalScroll
        : targetLogicalScroll;
      
      const currentScrollTop = containerRef.current.scrollTop;
      const distance = Math.abs(targetPhysicalScroll - currentScrollTop);
      const maxSmoothDistance = state.viewportHeight * 5;
      
      if (distance > maxSmoothDistance) {
        containerRef.current.scrollTo({ top: targetPhysicalScroll, behavior: 'auto' });
      } else {
        containerRef.current.scrollTo({ top: targetPhysicalScroll, behavior: 'smooth' });
      }
      
      actions.setJumpPulseIndex(scrollToIndex);
      const pulseTimer = setTimeout(() => {
        actions.setJumpPulseIndex(null);
      }, 2000);
      
      return () => clearTimeout(pulseTimer);
    }
  }, [scrollToIndex, totalLines, state.viewportHeight, useScrollScaling, maxLogicalScroll, maxPhysicalScroll, lineHeight, actions]);

  // ========== Visible Range Callback ==========
  useEffect(() => {
    onVisibleRangeChange?.(startIndex, endIndex);
  }, [startIndex, endIndex, onVisibleRangeChange]);

  // ========== Keyboard Shortcuts ==========
  useShortcut('escape', useCallback(() => {
    if (state.contextMenu) { actions.setContextMenu(null); return; }
    if (state.commentPopover) { actions.setCommentPopover(null); return; }
    if (state.expandedJsonLine !== null) { actions.setExpandedJsonLine(null); return; }
  }, [state.contextMenu, state.commentPopover, state.expandedJsonLine, actions]));

  // ========== Click Handlers ==========
  const handleClick = useCallback((e: React.MouseEvent) => {
    const pos = getPosFromEvent(e);
    if (!pos) return;

    if (pos.x < gutterWidth) {
      const line = state.bridgedLines.get(pos.lineIndex);
      const isLogLine = line && typeof line !== 'string';
      const logLine = isLogLine ? (line as HookLogLine) : null;
      const originalIndex = logLine ? logLine.index : pos.lineIndex;

      if (pos.x < 30 && logLine?.isMarked) {
        const rect = containerRef.current!.getBoundingClientRect();
        actions.setCommentPopover({
          x: rect.left + gutterWidth,
          y: e.clientY,
          lineIndex: originalIndex,
          comment: logLine.bookmarkComment || ''
        });
      } else {
        onToggleBookmark?.(originalIndex);
      }
    } else {
      if (!state.selection || (state.selection.startLine === state.selection.endLine && Math.abs(state.selection.startChar - state.selection.endChar) < 2)) {
        onLineClick?.(pos.lineIndex);
      }
      actions.setHighlightedWord(null);
      actions.setJumpPulseIndex(null);
    }
  }, [getPosFromEvent, gutterWidth, state.bridgedLines, state.selection, onLineClick, onToggleBookmark, actions]);

  // ========== Context Menu Handler ==========
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPosFromEvent(e);
    if (!pos) return;

    let selectedText = '';
    if (state.selection) {
      const { topLine, topChar, bottomLine, bottomChar } = 
        (state.selection.startLine < state.selection.endLine || 
         (state.selection.startLine === state.selection.endLine && state.selection.startChar <= state.selection.endChar))
          ? { topLine: state.selection.startLine, topChar: state.selection.startChar, bottomLine: state.selection.endLine, bottomChar: state.selection.endChar }
          : { topLine: state.selection.endLine, topChar: state.selection.endChar, bottomLine: state.selection.startLine, bottomChar: state.selection.startChar };
      
      if (topLine !== bottomLine || topChar !== bottomChar) {
        for (let i = topLine; i <= bottomLine; i++) {
          const line = state.bridgedLines.get(i);
          const text = typeof line === 'string' ? line : (line as HookLogLine)?.content || '';
          let s = 0, e = text.length;
          if (i === topLine && i === bottomLine) { s = topChar; e = bottomChar; }
          else if (i === topLine) { s = topChar; }
          else if (i === bottomLine) { e = bottomChar; }
          selectedText += text.substring(s, e) + (i === bottomLine ? '' : '\n');
        }
      }
    }

    const line = state.bridgedLines.get(pos.lineIndex);
    const originalIndex = (line && typeof line !== 'string') ? (line as HookLogLine).index : pos.lineIndex;

    actions.setContextMenu({ x: e.clientX, y: e.clientY, text: selectedText.trim(), lineIndex: originalIndex });
  }, [getPosFromEvent, state.selection, state.bridgedLines, actions]);

  // ========== Scroll Handler ==========
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const now = performance.now();
    const st = e.currentTarget.scrollTop;
    const sl = e.currentTarget.scrollLeft;

    if (now - lastScrollTimeRef.current > 0) {
      const delta = st - lastScrollTopRef.current;
      const timeDelta = now - lastScrollTimeRef.current;
      scrollVelocityRef.current = delta / timeDelta;
      scrollDirectionRef.current = delta > 0 ? 'down' : delta < 0 ? 'up' : scrollDirectionRef.current;
    }

    lastScrollTimeRef.current = now;
    lastScrollTopRef.current = st;

    actions.setScrollTop(st);
    actions.setScrollLeft(sl);
  }, [actions, lastScrollTimeRef, lastScrollTopRef, scrollVelocityRef, scrollDirectionRef]);

  // ========== Loading State ==========
  const showLoading = fileId && totalLines > 0 && state.viewportWidth > 0 && state.viewportHeight > 0 && state.bridgedLines.size === 0;
  const showLoadingPlaceholder = fileId && totalLines > 0 && (state.viewportWidth === 0 || state.viewportHeight === 0);

  return (
    <div
      ref={containerRef}
      data-viewer="true"
      data-pane-id={paneId}
      className="flex-1 overflow-auto relative custom-scrollbar"
      style={{ backgroundColor: colors.BACKGROUND }}
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => { actions.setHoveredLineIndex(null); actions.setHighlightedWord(null); }}
    >
      {fileId && totalLines > 0 && state.viewportWidth > 0 && state.viewportHeight > 0 && (
        <ErrorBoundary>
          <CanvasRenderer
            canvasRef={canvasRef}
            viewportWidth={state.viewportWidth}
            viewportHeight={state.viewportHeight}
            totalLines={totalLines}
            startIndex={startIndex}
            endIndex={endIndex}
            isVisible={!showLoading}
          />
        </ErrorBoundary>
      )}

      {/* Spacer for scrollable area */}
      <div style={{ height: virtualTotalHeight, width: state.maxLineWidth, pointerEvents: 'none' }} />
      
      {showLoadingPlaceholder && (
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: colors.BACKGROUND }}>
          <span style={{ color: colors.TEXT }}>加载中...</span>
        </div>
      )}

      {/* Context Menu Widget */}
      <ContextMenu
        contextMenu={state.contextMenu}
        setContextMenu={actions.setContextMenu}
        onAddLayer={onAddLayer}
        onToggleBookmark={onToggleBookmark}
        onUpdateBookmarkComment={onUpdateBookmarkComment}
        bridgedLines={state.bridgedLines}
        setExpandedJsonLine={actions.setExpandedJsonLine}
      />

      {/* Bookmark Popover */}
      {state.commentPopover && (
        <BookmarkPopover
          x={state.commentPopover.x}
          y={state.commentPopover.y}
          lineIndex={state.commentPopover.lineIndex}
          initialComment={state.commentPopover.comment}
          onSave={async (c) => { 
            await onUpdateBookmarkComment?.(state.commentPopover!.lineIndex, c); 
            actions.setCommentPopover(null); 
          }}
          onRemove={() => { 
            onToggleBookmark?.(state.commentPopover!.lineIndex); 
            actions.setCommentPopover(null); 
          }}
          onClose={() => actions.setCommentPopover(null)}
        />
      )}

      {/* JSON Viewer Widget */}
      <JsonExpandedViewer
        expandedJsonLine={state.expandedJsonLine}
        bridgedLines={state.bridgedLines}
        onClose={() => actions.setExpandedJsonLine(null)}
      />

      {/* Go To Line Widget */}
      {state.showGoToLine && (
        <EditorGoToLineWidget
          totalLines={totalLines}
          onGo={(lineNum) => {
            onLineClick?.(lineNum - 1);
            actions.setShowGoToLine(false);
          }}
          onClose={() => actions.setShowGoToLine(false)}
        />
      )}

      {/* Performance Panel Widget */}
      <PerformancePanel
        performanceStats={state.performanceStats}
        isVisible={state.showPerformancePanel}
        onToggle={() => actions.setShowPerformancePanel(p => !p)}
      />

      {/* New Content Button */}
      {hasNewContent && onScrollToNewContent && (
        <button
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full shadow-lg z-[1000] flex items-center gap-2 animate-bounce"
          onClick={() => onScrollToNewContent()}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>有新内容，点击滚动到底部</span>
        </button>
      )}

      {/* Screen Reader Status */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {state.selection ? `已选中 ${Math.abs(state.selection.endLine - state.selection.startLine) + 1} 行` : ''}
      </div>
    </div>
  );
};

export default LogViewer;