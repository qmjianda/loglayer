import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LogLine, LayerType } from '../types';
import { readProcessedLines } from '../bridge_client';
import { BookmarkPopover } from './BookmarkPopover';
import { EditorGoToLineWidget } from './EditorGoToLineWidget';
import { ErrorBoundary } from './ErrorBoundary';
import { JsonTreeView } from './JsonTreeView';
import { LOG_VIEWER } from '../constants';
import { getLogViewerColors } from '../theme';
import { AppSettings } from '../hooks/useSettings';
import { detectJson } from '../utils/jsonTree';
import { useShortcut } from '../shortcuts';

interface LogViewerProps {
  totalLines: number;
  fileId: string | null;
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
 * Normalize selection to top-to-bottom order regardless of drag direction.
 * Returns { topLine, topChar, bottomLine, bottomChar }.
 */
function normalizeSelection(sel: { startLine: number; startChar: number; endLine: number; endChar: number }) {
  if (sel.startLine < sel.endLine || (sel.startLine === sel.endLine && sel.startChar <= sel.endChar)) {
    return { topLine: sel.startLine, topChar: sel.startChar, bottomLine: sel.endLine, bottomChar: sel.endChar };
  }
  return { topLine: sel.endLine, topChar: sel.endChar, bottomLine: sel.startLine, bottomChar: sel.startChar };
}

/**
 * Get the character range [s, e) for a given line index within a normalized selection.
 */
function getLineSelectionRange(i: number, norm: ReturnType<typeof normalizeSelection>, contentLength: number) {
  let s = 0, e = contentLength;
  if (norm.topLine === norm.bottomLine) {
    s = norm.topChar;
    e = norm.bottomChar;
  } else if (i === norm.topLine) {
    s = norm.topChar;
    // e stays contentLength (select to end of line)
  } else if (i === norm.bottomLine) {
    e = norm.bottomChar;
    // s stays 0 (select from start of line)
  }
  // else: middle line, s=0, e=contentLength (entire line)
  return { s, e };
}

/**
 * LogViewer - Canvas-based Redesign
 *
 * Performance Optimized: Uses HTML5 Canvas for rendering millions of lines.
 * Hybrid Scroll: Native OS scrolling with Canvas drawing.
 * High-DPI: Sharp rendering on all displays.
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  totalLines,
  fileId,
  scrollToIndex,
  highlightedIndex,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [maxLineWidth, setMaxLineWidth] = useState(viewportWidth);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, text: string, lineIndex?: number } | null>(null);
  const [commentPopover, setCommentPopover] = useState<{ x: number, y: number, lineIndex: number, comment: string } | null>(null);
  const [expandedJsonLine, setExpandedJsonLine] = useState<number | null>(null);
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({ fps: 60, visibleLines: 0, memory: 0 });
  const [jumpPulseIndex, setJumpPulseIndex] = useState<number | null>(null);

  const [selection, setSelection] = useState<{
    startLine: number, startChar: number,
    endLine: number, endChar: number
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  
  // Word highlight state for double-click feature
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);

  const [bridgedLines, setBridgedLines] = useState<Map<number, LogLine | string>>(new Map());
  const lastFetchRef = useRef<{ start: number; end: number }>({ start: -1, end: -1 });
  const scrollVelocityRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const lastScrollTimeRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  const { LINE_HEIGHT, GUTTER_WIDTH, VIRTUAL_HEIGHT_LIMIT, BUFFER_NORMAL, BUFFER_LARGE, SCROLL_MARGIN, CHAR_WIDTH_DEFAULT } = LOG_VIEWER;

  const fontSize = settings?.fontSize ?? 12;
  const lineHeight = settings?.lineHeight ?? LINE_HEIGHT;
  const wordWrap = settings?.wordWrap ?? false;
  const showWhitespace = settings?.showWhitespace ?? false;
  const showLineNumbers = settings?.showLineNumbers ?? true;
  const virtualScrollBufferSetting = settings?.virtualScrollBuffer ?? 500;
  const searchHighlightAll = settings?.searchHighlightAll ?? true;
  const theme = resolvedTheme ?? 'dark';

  const gutterWidth = GUTTER_WIDTH;

  const realTotalHeight = useMemo(() => totalLines * lineHeight, [totalLines, lineHeight]);
  const useScrollScaling = useMemo(() => realTotalHeight > VIRTUAL_HEIGHT_LIMIT, [realTotalHeight]);
  const baseBuffer = useScrollScaling ? BUFFER_LARGE : BUFFER_NORMAL;
  const velocityBuffer = Math.abs(scrollVelocityRef.current) * 200;
  const directionBonus = scrollDirectionRef.current === 'down' ? 500 : 0;
  const dynamicBuffer = useMemo(() => 
    Math.floor(Math.min(virtualScrollBufferSetting, baseBuffer + velocityBuffer + directionBonus)),
    [virtualScrollBufferSetting, baseBuffer, velocityBuffer, directionBonus]
  );
  const buffer = dynamicBuffer;
  const virtualTotalHeight = useMemo(() => 
    (useScrollScaling ? VIRTUAL_HEIGHT_LIMIT : realTotalHeight) + SCROLL_MARGIN,
    [useScrollScaling, realTotalHeight]
  );
  const colors = useMemo(() => getLogViewerColors(theme as 'dark' | 'light'), [theme]);

  const charWidthRef = useRef(CHAR_WIDTH_DEFAULT);
  const font = useMemo(() => `${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`, [fontSize]);

  // Persistent offscreen canvas for text measurement (CJK-safe)
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);

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

  /** Get pixel width for text.substring(0, charIndex) using actual measureText */
  const measureSubstringWidth = useCallback((text: string, start: number, end: number): number => {
    const mctx = measureCtxRef.current;
    if (!mctx || start >= end) return 0;
    return mctx.measureText(text.substring(start, end)).width;
  }, []);

  /** Convert pixel x-offset within a line's text to a character index (binary search) */
  const charIndexFromX = useCallback((text: string, xOffset: number): number => {
    const mctx = measureCtxRef.current;
    if (!mctx || xOffset <= 0 || !text) return 0;
    // Binary search for the character position
    let low = 0, high = text.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (mctx.measureText(text.substring(0, mid)).width < xOffset) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    // Snap to nearest character boundary
    if (low > 0) {
      const prevW = mctx.measureText(text.substring(0, low - 1)).width;
      const curW = mctx.measureText(text.substring(0, low)).width;
      if (xOffset - prevW < curW - xOffset) return low - 1;
    }
    return Math.min(low, text.length);
  }, []);

  const initialDimensionsSet = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setViewportWidth(clientWidth);
          setViewportHeight(clientHeight);
          initialDimensionsSet.current = true;
        }
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setViewportWidth(entry.contentRect.width);
        }
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const maxPhysicalScroll = Math.max(0, virtualTotalHeight - viewportHeight);
  const maxLogicalScroll = Math.max(0, realTotalHeight - viewportHeight);
  const effectiveScrollTop = useScrollScaling && maxPhysicalScroll > 0
    ? (scrollTop / maxPhysicalScroll) * maxLogicalScroll
    : scrollTop;

  const startIndex = Math.max(0, Math.floor(effectiveScrollTop / lineHeight) - buffer);
  const endIndex = Math.min(totalLines, Math.ceil((effectiveScrollTop + viewportHeight) / lineHeight) + buffer);

  useEffect(() => {
    setBridgedLines(new Map());
    lastFetchRef.current = { start: -1, end: -1 };
  }, [fileId]);

  useEffect(() => {
    lastFetchRef.current = { start: -1, end: -1 };
  }, [updateTrigger]);

  useEffect(() => {
    if (!fileId || totalLines === 0) return;
    if (startIndex === lastFetchRef.current.start && endIndex === lastFetchRef.current.end) return;

    lastFetchRef.current = { start: startIndex, end: endIndex };
    let ignore = false;

    const timer = setTimeout(async () => {
      try {
        const count = endIndex - startIndex;
        if (count <= 0 || ignore) return;
        const lines = await readProcessedLines(fileId, startIndex, count);
        if (ignore) return;

        setBridgedLines(prev => {
          const next = new Map(prev);
          let newMaxInnerWidth = maxLineWidth;
          lines.forEach((line, idx) => {
            const lineIdx = startIndex + idx;
            next.set(lineIdx, line);

            const content = typeof line === 'string' ? line : line.content || '';
            const measuredW = measureCtxRef.current
              ? measureCtxRef.current.measureText(content).width
              : content.length * charWidthRef.current;
            const lineW = measuredW + gutterWidth + 100;
            if (lineW > newMaxInnerWidth) newMaxInnerWidth = lineW;
          });

          if (newMaxInnerWidth > maxLineWidth) {
            setMaxLineWidth(newMaxInnerWidth);
          }

          if (next.size > LOG_VIEWER.MAX_CACHED_LINES) {
            const center = Math.floor((startIndex + endIndex) / 2);
            for (const key of next.keys()) {
              if (Math.abs(Number(key) - center) > LOG_VIEWER.CACHE_CLEAR_DISTANCE) next.delete(key);
            }
          }
          return next;
        });
      } catch (e) { console.error('Failed to fetch lines:', e); }
    }, LOG_VIEWER.FETCH_DEBOUNCE_MS);

    return () => { ignore = true; clearTimeout(timer); };
  }, [startIndex, endIndex, fileId, totalLines, updateTrigger]);

  useEffect(() => {
    onVisibleRangeChange?.(startIndex, endIndex);
  }, [startIndex, endIndex, onVisibleRangeChange]);

  useEffect(() => {
    if (scrollToIndex !== null && scrollToIndex !== undefined && containerRef.current) {
      const targetLogicalScroll = Math.max(0, scrollToIndex * lineHeight - (viewportHeight / 3));
      const targetPhysicalScroll = useScrollScaling && maxLogicalScroll > 0
        ? (targetLogicalScroll / maxLogicalScroll) * maxPhysicalScroll
        : targetLogicalScroll;
      
      const currentScrollTop = containerRef.current.scrollTop;
      const distance = Math.abs(targetPhysicalScroll - currentScrollTop);
      const maxSmoothDistance = viewportHeight * 5;
      
      if (distance > maxSmoothDistance) {
        containerRef.current.scrollTo({ top: targetPhysicalScroll, behavior: 'auto' });
      } else {
        containerRef.current.scrollTo({ top: targetPhysicalScroll, behavior: 'smooth' });
      }
      
      setJumpPulseIndex(scrollToIndex);
      const pulseTimer = setTimeout(() => {
        setJumpPulseIndex(null);
      }, 2000);
      
      return () => clearTimeout(pulseTimer);
    }
  }, [scrollToIndex, totalLines, viewportHeight, useScrollScaling, maxLogicalScroll, maxPhysicalScroll, lineHeight]);

  const getPosFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is actually inside the container boundaries visually
    const isInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    const logicalY = y + effectiveScrollTop;
    const lineIndex = Math.floor(logicalY / lineHeight);
    // Use measureText for accurate CJK character positioning
    const pixelOffset = Math.max(0, x - gutterWidth + scrollLeft);
    const line = bridgedLines.get(lineIndex);
    const lineContent = typeof line === 'string' ? line : (line as LogLine)?.content || '';
    const charIndex = charIndexFromX(lineContent, pixelOffset);
    return { lineIndex, charIndex, x, y, isInside };
  }, [effectiveScrollTop, gutterWidth, scrollLeft, bridgedLines, charIndexFromX, lineHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getPosFromEvent(e);
    if (!pos || !pos.isInside) return;

    setSelection({ startLine: pos.lineIndex, startChar: pos.charIndex, endLine: pos.lineIndex, endChar: pos.charIndex });
    setIsSelecting(true);
    setContextMenu(null);
  }, [getPosFromEvent]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const pos = getPosFromEvent(e);
    if (!pos) return;

    if (!isSelecting) {
      // Only track hovered line if mouse is ACTUALLY inside the viewer
      if (pos.isInside && pos.lineIndex >= 0 && pos.lineIndex < totalLines) {
        setHoveredLineIndex(pos.lineIndex);
      } else {
        setHoveredLineIndex(null);
      }
      return;
    }

    // If we ARE selecting, keep tracking even if dragging outside bounds to allow scroll-select
    setSelection(prev => prev ? { ...prev, endLine: pos.lineIndex, endChar: pos.charIndex } : null);
  }, [isSelecting, getPosFromEvent, totalLines]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Custom wheel handler: normalized scrolling with trackpad support
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Detect trackpad vs mouse wheel: trackpad typically sends smaller, pixel-based deltas
      const isTrackpad = Math.abs(e.deltaY) < 50 && e.deltaMode === 0;
      let logicalDelta: number;
      if (isTrackpad) {
        // Smooth pixel-level scrolling for trackpad
        logicalDelta = e.deltaY;
      } else {
        // Discrete line-based scrolling for mouse wheel
        const linesToScroll = LOG_VIEWER.WHEEL_LINES_PER_TICK;
        logicalDelta = Math.sign(e.deltaY) * linesToScroll * lineHeight;
      }
      const physicalDelta = useScrollScaling && maxLogicalScroll > 0
        ? (logicalDelta / maxLogicalScroll) * maxPhysicalScroll
        : logicalDelta;
      container.scrollTop += physicalDelta;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [useScrollScaling, maxLogicalScroll, maxPhysicalScroll, lineHeight]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        if (commentPopover) { setCommentPopover(null); return; }
        if (expandedJsonLine !== null) { setExpandedJsonLine(null); return; }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu, commentPopover, expandedJsonLine]);

  useShortcut('selectLine', useCallback(() => {
    if (hoveredLineIndex !== null) {
      const line = bridgedLines.get(hoveredLineIndex);
      const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
      setSelection({
        startLine: hoveredLineIndex,
        startChar: 0,
        endLine: hoveredLineIndex,
        endChar: content.length
      });
    } else if (highlightedIndex !== null) {
      const line = bridgedLines.get(highlightedIndex);
      const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
      setSelection({
        startLine: highlightedIndex,
        startChar: 0,
        endLine: highlightedIndex,
        endChar: content.length
      });
    }
  }, [hoveredLineIndex, highlightedIndex, bridgedLines]));

  useShortcut('jumpToSelection', useCallback(() => {
    if (selection) {
      const norm = normalizeSelection(selection);
      onLineClick?.(norm.topLine);
    }
  }, [selection, onLineClick]));

  useShortcut('moveSelectionUp', useCallback(() => {
    if (selection) {
      const norm = normalizeSelection(selection);
      const newTopLine = Math.max(0, norm.topLine - 1);
      const newBottomLine = Math.max(0, norm.bottomLine - 1);
      setSelection({
        startLine: newTopLine,
        startChar: norm.topChar,
        endLine: newBottomLine,
        endChar: norm.bottomChar
      });
    }
  }, [selection]));

  useShortcut('moveSelectionDown', useCallback(() => {
    if (selection) {
      const norm = normalizeSelection(selection);
      const newTopLine = Math.min(totalLines - 1, norm.topLine + 1);
      const newBottomLine = Math.min(totalLines - 1, norm.bottomLine + 1);
      setSelection({
        startLine: newTopLine,
        startChar: norm.topChar,
        endLine: newBottomLine,
        endChar: norm.bottomChar
      });
    }
  }, [selection, totalLines]));

  useShortcut('selectAll', useCallback(() => {
    setSelection({
      startLine: 0,
      startChar: 0,
      endLine: totalLines - 1,
      endChar: 0
    });
  }, [totalLines]));

  const handleClick = (e: React.MouseEvent) => {
    const pos = getPosFromEvent(e);
    if (!pos) return;

    if (pos.x < gutterWidth) {
      const line = bridgedLines.get(pos.lineIndex);
      const isLogLine = line && typeof line !== 'string';
      const logLine = isLogLine ? (line as LogLine) : null;
      const originalIndex = logLine ? logLine.index : pos.lineIndex;

      if (pos.x < 30 && logLine?.isMarked) {
        const rect = containerRef.current!.getBoundingClientRect();
        setCommentPopover({
          x: rect.left + gutterWidth,
          y: e.clientY,
          lineIndex: originalIndex,
          comment: logLine.bookmarkComment || ''
        });
      } else {
        onToggleBookmark?.(originalIndex);
      }
    } else {
      if (!selection || (selection.startLine === selection.endLine && Math.abs(selection.startChar - selection.endChar) < 2)) {
        onLineClick?.(pos.lineIndex);
      }
      setHighlightedWord(null);
    }
  };

  // Double-click handler: select the word under cursor
  const handleDoubleClick = (e: React.MouseEvent) => {
    const pos = getPosFromEvent(e);
    if (!pos || pos.x < gutterWidth) return;

    const line = bridgedLines.get(pos.lineIndex);
    const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
    if (!content) return;

    const charIndex = pos.charIndex;
    let start = charIndex;
    let end = charIndex;

    while (start > 0 && /[\w]/.test(content[start - 1])) {
      start--;
    }

    while (end < content.length && /[\w]/.test(content[end])) {
      end++;
    }

    if (end > start) {
      setSelection({
        startLine: pos.lineIndex,
        startChar: start,
        endLine: pos.lineIndex,
        endChar: end
      });
      setIsSelecting(false);
      
      const selectedWord = content.substring(start, end);
      if (selectedWord.length >= 2) {
        setHighlightedWord(selectedWord);
      }
    }
  };

  // Report selected text to parent (for Ctrl+F auto-fill etc.)
  useEffect(() => {
    if (!selection || !onSelectedTextChange) return;
    const norm = normalizeSelection(selection);
    if (norm.topLine === norm.bottomLine && norm.topChar === norm.bottomChar) {
      onSelectedTextChange('');
      return;
    }
    let text = '';
    for (let i = norm.topLine; i <= norm.bottomLine; i++) {
      const line = bridgedLines.get(i);
      const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
      const { s, e } = getLineSelectionRange(i, norm, content.length);
      text += content.substring(s, e) + (i === norm.bottomLine ? '' : '\n');
    }
    onSelectedTextChange(text.trim());
  }, [selection, bridgedLines, onSelectedTextChange]);

  useEffect(() => {
    const handleCopyEvent = (e: ClipboardEvent) => {
      // If we have a selection, use our calculated text for native copy
      if (selection) {
        let selectedText = '';
        const norm = normalizeSelection(selection);

        for (let i = norm.topLine; i <= norm.bottomLine; i++) {
          const line = bridgedLines.get(i);
          const text = typeof line === 'string' ? line : (line as LogLine)?.content || '';
          const { s, e } = getLineSelectionRange(i, norm, text.length);
          selectedText += text.substring(s, e) + (i === norm.bottomLine ? '' : '\n');
        }

        if (selectedText) {
          e.clipboardData?.setData('text/plain', selectedText.trim());
          e.preventDefault();
        }
      }
    };
    window.addEventListener('copy', handleCopyEvent);
    return () => window.removeEventListener('copy', handleCopyEvent);
  }, [selection, bridgedLines]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getPosFromEvent(e);
    if (!pos) return;

    let selectedText = '';
    if (selection) {
      const norm = normalizeSelection(selection);
      if (norm.topLine !== norm.bottomLine || norm.topChar !== norm.bottomChar) {
        for (let i = norm.topLine; i <= norm.bottomLine; i++) {
          const line = bridgedLines.get(i);
          const text = typeof line === 'string' ? line : (line as LogLine)?.content || '';
          const { s, e } = getLineSelectionRange(i, norm, text.length);
          selectedText += text.substring(s, e) + (i === norm.bottomLine ? '' : '\n');
        }
      }
    }

    const line = bridgedLines.get(pos.lineIndex);
    const originalIndex = (line && typeof line !== 'string') ? (line as LogLine).index : pos.lineIndex;

    setContextMenu({ x: e.clientX, y: e.clientY, text: selectedText.trim(), lineIndex: originalIndex });
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    try {
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.floor(viewportWidth * dpr);
      const targetHeight = Math.floor(viewportHeight * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Read scroll position directly from DOM for frame-perfect rendering
      const currentScrollTop = containerRef.current?.scrollTop || 0;
      const currentScrollLeft = containerRef.current?.scrollLeft || 0;
      const drawEffectiveScroll = useScrollScaling && maxPhysicalScroll > 0
        ? (currentScrollTop / maxPhysicalScroll) * maxLogicalScroll
        : currentScrollTop;
      const safeScrollTop = Number.isFinite(drawEffectiveScroll) ? drawEffectiveScroll : 0;
      const safeScrollLeft = Number.isFinite(currentScrollLeft) ? currentScrollLeft : 0;

      const effectiveRulerWidth = 0;
      const effectiveViewportWidth = viewportWidth;

      // 只有在有数据时才填充背景
      if (totalLines > 0) {
        ctx.fillStyle = colors.BACKGROUND;
        ctx.fillRect(0, 0, effectiveViewportWidth, viewportHeight);

        if (bridgedLines.size === 0) {
          ctx.font = '14px "JetBrains Mono"';
          ctx.fillStyle = colors.TEXT;
          ctx.textAlign = 'center';

          const centerX = effectiveViewportWidth / 2;
          const centerY = viewportHeight / 2;

          if (isIndexing) {
            ctx.fillText(`正在构建索引... ${Math.round(indexingProgress)}%`, centerX, centerY - 10);
            ctx.font = '12px "JetBrains Mono"';
            ctx.fillStyle = colors.GUTTER_TEXT;
            ctx.fillText('请稍候', centerX, centerY + 15);
          } else if (isSearching) {
            ctx.fillText('正在搜索...', centerX, centerY - 10);
            ctx.font = '12px "JetBrains Mono"';
            ctx.fillStyle = colors.GUTTER_TEXT;
            ctx.fillText(`${totalLines.toLocaleString()} 行待处理`, centerX, centerY + 15);
          } else if (bridgedLines.size === 0) {
            // No data loaded at all - show initial loading message
            ctx.fillText(`加载中... ${totalLines.toLocaleString()} 行`, centerX, centerY - 10);
          } else {
            // Data is loaded, don't show loading message
            // (Lazy loading happens automatically in background)
          }
          return;
        }
      } else {
        ctx.clearRect(0, 0, viewportWidth, viewportHeight);
        return;
      }

      const firstVisibleY = (startIndex * lineHeight) - safeScrollTop;

      for (let i = startIndex; i < endIndex; i++) {
        if (i >= totalLines) break;
        const line = bridgedLines.get(i);
        const y = firstVisibleY + (i - startIndex) * lineHeight;
        if (y + lineHeight < 0 || y > viewportHeight) continue;

        const isLogLine = line && typeof line !== 'string';
        const logLine = isLogLine ? (line as LogLine) : null;
        const content = typeof line === 'string' ? line : logLine?.content || '';
        const isMarked = logLine?.isMarked;

        // 1. Backgrounds
        const rowStyle = logLine?.rowStyle;
        const hasData = line !== undefined;
        
        if (jumpPulseIndex === i) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, y, effectiveViewportWidth, lineHeight);
        }
        
        if (highlightedIndex === i) {
          // Current line highlight — use theme color
          ctx.fillStyle = colors.HIGHLIGHT_LINE;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
          // Left indicator bar for current line
          ctx.fillStyle = colors.CURRENT_LINE;
          ctx.fillRect(0, y, 3, lineHeight);
        } else if (rowStyle?.backgroundColor) {
          ctx.fillStyle = rowStyle.backgroundColor;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        } else if (isMarked) {
          // Bookmark background with subtle left-to-right gradient
          const grad = ctx.createLinearGradient(0, y, effectiveViewportWidth * 0.5, y);
          grad.addColorStop(0, colors.BOOKMARK_BACKGROUND);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        } else if (hoveredLineIndex === i && !isSelecting) {
          // Hover highlight — subtle feedback
          ctx.fillStyle = colors.HOVER_LINE;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        } else if (!hasData) {
          // Loading placeholder
          ctx.fillStyle = colors.BACKGROUND;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        }

        // Selection highlight (measureText for CJK-safe widths)
        if (selection) {
          const norm = normalizeSelection(selection);
          if (i >= norm.topLine && i <= norm.bottomLine) {
            const { s, e } = getLineSelectionRange(i, norm, content.length);
            const selX = measureSubstringWidth(content, 0, s);
            const selW = measureSubstringWidth(content, s, e);
            ctx.fillStyle = colors.SELECTION;
            ctx.fillRect(gutterWidth + selX - safeScrollLeft, y, selW, lineHeight);
          }
        }

        // 2. Content text
        ctx.save();
        ctx.beginPath();
        // Clip to exactly the content area, preventing text/descenders from bleeding into the gutter or adjacent lines
        const contentLeftX = showLineNumbers ? gutterWidth : 0;
        ctx.rect(contentLeftX, y, viewportWidth - contentLeftX, lineHeight);
        ctx.clip();

        ctx.font = font;
        ctx.textAlign = 'left';
        const contentX = showLineNumbers ? (gutterWidth - safeScrollLeft) : (-safeScrollLeft);
        const effectiveGutterWidth = showLineNumbers ? gutterWidth : 0;
        const maxCharsPerLine = Math.floor((viewportWidth - effectiveRulerWidth - effectiveGutterWidth) / charWidthRef.current);

        let displayContent = content;
        if (showWhitespace) {
          displayContent = content
            .replace(/ /g, '\u00B7')
            .replace(/\t/g, '\u2192 ');
        }

        const renderText = (text: string, startX: number, startY: number) => {
          const allHighlights: Array<{ start: number; end: number; color: string; opacity: number; isSearch?: boolean }> = [];
          
          if (searchHighlightAll && logLine?.highlights) {
            allHighlights.push(...logLine.highlights);
          }
          
          if (highlightedWord && highlightedWord.length >= 2) {
            const wordRegex = new RegExp(`\\b${highlightedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            let match;
            while ((match = wordRegex.exec(text)) !== null) {
              const existing = allHighlights.find(h => h.start === match!.index && h.end === match!.index + match![0].length);
              if (!existing) {
                allHighlights.push({
                  start: match.index,
                  end: match.index + match[0].length,
                  color: colors.WORD_HIGHLIGHT,
                  opacity: 100,
                  isSearch: false
                });
              }
            }
          }
          
          if (allHighlights.length > 0) {
            let lastIdx = 0;
            const sorted = [...allHighlights].sort((a, b) => a.start - b.start);
            sorted.forEach(h => {
              if (h.start > lastIdx) {
                ctx.fillStyle = colors.TEXT;
                const segX = startX + measureSubstringWidth(text, 0, lastIdx);
                ctx.fillText(text.substring(lastIdx, h.start), segX, startY);
              }
              const opacity = (h.opacity || 100) / 100;
              const hText = text.substring(h.start, h.end);
              const hlPixelX = startX + measureSubstringWidth(text, 0, h.start);
              if (h.isSearch || h.color === '#facc15') {
                const hlW = measureSubstringWidth(text, h.start, h.end);
                const hlY = y;
                const hlH = lineHeight;
                ctx.fillStyle = h.color;
                ctx.beginPath();
                ctx.roundRect(hlPixelX, hlY, hlW, hlH, 2);
                ctx.fill();
                ctx.fillStyle = '#000';
              } else {
                const hlW = measureSubstringWidth(text, h.start, h.end);
                const hlY = y;
                const hlH = lineHeight;
                ctx.fillStyle = h.color.startsWith('#') ? `${h.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}` : h.color;
                ctx.fillRect(hlPixelX, hlY, hlW, hlH);
                ctx.fillStyle = '#000';
              }
              ctx.fillText(hText, hlPixelX, startY);
              lastIdx = h.end;
            });
            if (lastIdx < text.length) {
              ctx.fillStyle = colors.TEXT;
              const segX = startX + measureSubstringWidth(text, 0, lastIdx);
              ctx.fillText(text.substring(lastIdx), segX, startY);
            }
          } else {
            ctx.fillStyle = rowStyle?.color || colors.TEXT;
            ctx.fillText(text, startX, startY);
          }
        };

        if (wordWrap && maxCharsPerLine > 0) {
          const lines = [];
          for (let i = 0; i < displayContent.length; i += maxCharsPerLine) {
            lines.push(displayContent.substring(i, i + maxCharsPerLine));
          }
          lines.forEach((lineText, lineIdx) => {
            renderText(lineText, contentX, y + lineHeight / 2 + 4 + lineIdx * lineHeight);
          });
        } else {
          renderText(displayContent, contentX, y + lineHeight / 2 + 4);
        }

        ctx.restore();

        // 3. Gutter overlay (drawn AFTER content so it always stays on top)
        if (showLineNumbers) {
          ctx.fillStyle = colors.GUTTER;
          ctx.fillRect(0, y, gutterWidth, lineHeight);

          // Gutter separator line (at right edge of gutter)
          ctx.fillStyle = colors.GUTTER_SEPARATOR;
          ctx.fillRect(gutterWidth - 1, y, 1, lineHeight);

          const gutterFontSize = Math.max(10, fontSize - 2);
          ctx.font = `${gutterFontSize}px "JetBrains Mono", monospace`;
          ctx.textBaseline = 'middle';
          ctx.fillStyle = highlightedIndex === i ? colors.CURRENT_LINE
            : hoveredLineIndex === i ? colors.TEXT
              : colors.GUTTER_TEXT;
          ctx.textAlign = 'right';
          ctx.fillText((i + 1).toLocaleString(), gutterWidth - 15, y + lineHeight / 2);
          ctx.textBaseline = 'alphabetic';
        }

        if (isMarked) {
          // Draw bookmark icon using canvas path (flag/diamond shape)
          ctx.fillStyle = colors.BOOKMARK_INDICATOR;
          const iconX = 15;
          const iconY = y + lineHeight / 2;
          if (logLine?.bookmarkComment) {
            // Star-like bookmark with comment: filled bookmark flag
            ctx.beginPath();
            ctx.moveTo(iconX - 4, iconY - 5);
            ctx.lineTo(iconX + 4, iconY - 5);
            ctx.lineTo(iconX + 4, iconY + 5);
            ctx.lineTo(iconX, iconY + 2);
            ctx.lineTo(iconX - 4, iconY + 5);
            ctx.closePath();
            ctx.fill();
          } else {
            // Simple bookmark: small filled circle
            ctx.beginPath();
            ctx.arc(iconX, iconY, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // Left indicator bar
          ctx.fillStyle = colors.BOOKMARK_INDICATOR;
          ctx.fillRect(0, y, 2, lineHeight);
        }
      }
    } catch (err) {
      console.error('Canvas draw error:', err);
    }
  }, [viewportWidth, viewportHeight, startIndex, endIndex, bridgedLines, selection, highlightedIndex, hoveredLineIndex, isSelecting, totalLines, layerStats, bookmarks, useScrollScaling, maxPhysicalScroll, maxLogicalScroll, lineHeight, showLineNumbers, wordWrap, showWhitespace, fontSize, searchHighlightAll, settings, jumpPulseIndex]);

  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());
  const lastDrawDepsRef = useRef<string>('');

  useEffect(() => {
    const currentDeps = `${startIndex}-${endIndex}-${scrollTop}-${scrollLeft}-${highlightedIndex}-${hoveredLineIndex}-${selection?.startLine}-${bridgedLines.size}-${highlightedWord}`;
    const needsRedraw = lastDrawDepsRef.current !== currentDeps;
    lastDrawDepsRef.current = currentDeps;

    const updatePerformanceStats = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastFpsUpdateRef.current;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        const visibleLines = endIndex - startIndex;
        const memory = performance.memory
          ? Math.round(performance.memory.usedJSHeapSize / 1048576)
          : 0;

        setPerformanceStats({ fps, visibleLines, memory });
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    };

    if (needsRedraw) {
      const frame = requestAnimationFrame(() => {
        draw();
        updatePerformanceStats();
      });
      return () => cancelAnimationFrame(frame);
    } else {
      updatePerformanceStats();
    }
  }, [draw, startIndex, endIndex, scrollTop, scrollLeft, highlightedIndex, hoveredLineIndex, selection, bridgedLines.size, highlightedWord]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto relative custom-scrollbar"
      style={{ backgroundColor: colors.BACKGROUND }}
      onScroll={(e) => {
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



        setScrollTop(st);
        setScrollLeft(sl);
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => { setHoveredLineIndex(null); setHighlightedWord(null); }}
    >
      {fileId && totalLines > 0 && viewportWidth > 0 && viewportHeight > 0 && (
        <div style={{ position: 'sticky', top: 0, left: 0, width: 0, height: 0, overflow: 'visible', zIndex: 1 }}>
          <ErrorBoundary>
            <canvas
              ref={canvasRef}
              role="log"
              aria-label={`日志视图，共 ${totalLines.toLocaleString()} 行。当前显示第 ${startIndex + 1} 到 ${endIndex} 行`}
              aria-readonly="true"
              tabIndex={0}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: viewportWidth,
                height: viewportHeight,
                pointerEvents: 'none',
              }}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Spacer in normal flow to create scrollable area */}
      <div style={{ height: virtualTotalHeight, width: maxLineWidth, pointerEvents: 'none' }} />
      {fileId && totalLines > 0 && (viewportWidth === 0 || viewportHeight === 0) && (
        <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: colors.BACKGROUND }}>
          <span style={{ color: colors.TEXT }}>加载中...</span>
        </div>
      )}

      {contextMenu && createPortal(
        <>
          {/* Backdrop to capture click-outside */}
          <div className="fixed inset-0 z-[999]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[1000] select-none scale-in-center"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              minWidth: 200,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(30, 30, 30, 0.85)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
              padding: '4px 0',
              fontSize: 12,
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            {contextMenu.text && (
              <>
                <button className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-gray-200 hover:bg-white/10 transition-colors duration-100" onClick={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null); }}>
                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" /></svg>
                  <span className="flex-1">复制选中内容</span>
                  <span className="text-gray-500 text-[11px] ml-4">Ctrl+C</span>
                </button>
                <button className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-gray-200 hover:bg-white/10 transition-colors duration-100" onClick={() => { onAddLayer?.(LayerType.HIGHLIGHT, { query: contextMenu.text, color: '#facc15' }); setContextMenu(null); }}>
                  <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg>
                  <span className="flex-1">以此高亮</span>
                </button>
                <button className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-gray-200 hover:bg-white/10 transition-colors duration-100" onClick={() => { onAddLayer?.(LayerType.FILTER, { query: contextMenu.text }); setContextMenu(null); }}>
                  <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
                  <span className="flex-1">以此过滤</span>
                </button>
                {detectJson(contextMenu.text).valid && (
                  <button className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-gray-200 hover:bg-white/10 transition-colors duration-100" onClick={() => { setExpandedJsonLine(contextMenu.lineIndex ?? null); setContextMenu(null); }}>
                    <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                    <span className="flex-1">展开 JSON</span>
                  </button>
                )}
                <div className="mx-2 my-1" style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </>
            )}
            <button className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-gray-200 hover:bg-white/10 transition-colors duration-100" onClick={() => { onToggleBookmark?.(contextMenu.lineIndex!); setContextMenu(null); }}>
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
              <span className="flex-1">切换书签</span>
            </button>
            <button className="w-full text-left px-3 py-[6px] flex items-center gap-2 text-gray-200 hover:bg-white/10 transition-colors duration-100" onClick={() => {
              const line = bridgedLines.get(contextMenu.lineIndex!);
              navigator.clipboard.writeText(typeof line === 'string' ? line : (line as LogLine)?.content || '');
              setContextMenu(null);
            }}>
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.75 9h16.5m-16.5 6.75h16.5" /></svg>
              <span className="flex-1">复制整行</span>
            </button>
          </div>
        </>,
        document.body
      )}

      {commentPopover && createPortal(
        <BookmarkPopover
          x={commentPopover.x}
          y={commentPopover.y}
          lineIndex={commentPopover.lineIndex}
          initialComment={commentPopover.comment}
          onSave={async (c) => { await onUpdateBookmarkComment?.(commentPopover.lineIndex, c); setCommentPopover(null); }}
          onRemove={() => { onToggleBookmark?.(commentPopover.lineIndex); setCommentPopover(null); }}
          onClose={() => setCommentPopover(null)}
        />,
        document.body
      )}

      {expandedJsonLine !== null && createPortal(
        <div className="fixed bottom-4 right-4 w-96 max-h-64 overflow-auto bg-theme-surface border border-theme-default shadow-2xl rounded z-[1000]">
          <div className="flex justify-between items-center px-3 py-2 border-b border-theme-subtle">
            <span className="text-sm font-medium text-theme-primary">JSON 展开 (行 {expandedJsonLine + 1})</span>
            <button onClick={() => setExpandedJsonLine(null)} className="text-theme-muted hover:text-theme-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-2">
            {(() => {
              const line = bridgedLines.get(expandedJsonLine);
              const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
              const { valid, data } = detectJson(content);
              if (!valid) return <div className="text-red-400">无效的 JSON</div>;
              return <JsonTreeView jsonString={JSON.stringify(data, null, 2)} />;
            })()}
          </div>
        </div>,
        document.body
      )}

      {showGoToLine && (
        <EditorGoToLineWidget
          totalLines={totalLines}
          onGo={(lineNum) => {
            onLineClick?.(lineNum - 1);
            setShowGoToLine(false);
          }}
          onClose={() => setShowGoToLine(false)}
        />
      )}

      {showPerformancePanel && (
        <div className="fixed bottom-2 right-2 bg-black/80 text-xs p-2 rounded z-[1000] text-gray-300 font-mono">
          <div className="flex gap-3">
            <span>FPS: <span className={performanceStats.fps < 30 ? 'text-red-400' : performanceStats.fps < 50 ? 'text-yellow-400' : 'text-green-400'}>{performanceStats.fps}</span></span>
            <span>Lines: {performanceStats.visibleLines.toLocaleString()}</span>
            <span>Mem: {performanceStats.memory}MB</span>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-8 right-2 text-[10px] text-gray-600 hover:text-gray-400 z-[1000]"
        onClick={(e) => {
          e.stopPropagation();
          setShowPerformancePanel(p => !p);
        }}
      >
        {showPerformancePanel ? 'Hide' : 'Perf'}
      </button>

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

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {selection ? `已选中 ${Math.abs(selection.endLine - selection.startLine) + 1} 行` : ''}
      </div>
    </div>
  );
};
