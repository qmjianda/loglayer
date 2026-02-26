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
  onSendToAI?: (text: string) => void;
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
  searchQuery,
  searchConfig,
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
  onSendToAI,
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

  const [selection, setSelection] = useState<{
    startLine: number, startChar: number,
    endLine: number, endChar: number
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

  const [bridgedLines, setBridgedLines] = useState<Map<number, LogLine | string>>(new Map());
  const lastFetchRef = useRef<{ start: number; end: number }>({ start: -1, end: -1 });
  const scrollVelocityRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const lastScrollTimeRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  const { LINE_HEIGHT, GUTTER_WIDTH, VIRTUAL_HEIGHT_LIMIT, BUFFER_NORMAL, BUFFER_LARGE, SCROLL_MARGIN, CHAR_WIDTH_DEFAULT, FONT } = LOG_VIEWER;
  
  const fontSize = settings?.fontSize ?? 12;
  const lineHeight = settings?.lineHeight ?? LINE_HEIGHT;
  const wordWrap = settings?.wordWrap ?? false;
  const showWhitespace = settings?.showWhitespace ?? false;
  const showLineNumbers = settings?.showLineNumbers ?? true;
  const showRuler = settings?.showRuler ?? true;
  const virtualScrollBufferSetting = settings?.virtualScrollBuffer ?? 500;
  const searchHighlightAll = settings?.searchHighlightAll ?? true;
  const theme = resolvedTheme ?? 'dark';
  const colors = getLogViewerColors(theme as 'dark' | 'light');
  
  const gutterWidth = GUTTER_WIDTH;

  const realTotalHeight = totalLines * lineHeight;
  const useScrollScaling = realTotalHeight > VIRTUAL_HEIGHT_LIMIT;
  const baseBuffer = useScrollScaling ? BUFFER_LARGE : BUFFER_NORMAL;
  const velocityBuffer = Math.abs(scrollVelocityRef.current) * 200;
  const directionBonus = scrollDirectionRef.current === 'down' ? 500 : 0;
  const dynamicBuffer = Math.min(virtualScrollBufferSetting, baseBuffer + velocityBuffer + directionBonus);
  const buffer = dynamicBuffer;
  const scaleFactor = useScrollScaling ? VIRTUAL_HEIGHT_LIMIT / realTotalHeight : 1;
  const virtualTotalHeight = (useScrollScaling ? VIRTUAL_HEIGHT_LIMIT : realTotalHeight) + SCROLL_MARGIN;

  const charWidthRef = useRef(CHAR_WIDTH_DEFAULT);
  const font = `${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = font;
      const testStr = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      charWidthRef.current = ctx.measureText(testStr).width / testStr.length;
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight);
        setViewportWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

            // 跟踪最大行宽
            const content = typeof line === 'string' ? line : line.content || '';
            const lineW = content.length * charWidthRef.current + gutterWidth + 100;
            if (lineW > newMaxInnerWidth) newMaxInnerWidth = lineW;
          });

          if (newMaxInnerWidth > maxLineWidth) setMaxLineWidth(newMaxInnerWidth);

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
      containerRef.current.scrollTo({ top: targetPhysicalScroll, behavior: 'auto' });
    }
  }, [scrollToIndex, totalLines, viewportHeight, useScrollScaling, maxLogicalScroll, maxPhysicalScroll]);

  const getPosFromEvent = (e: MouseEvent | React.MouseEvent) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const logicalY = y + effectiveScrollTop;
    const lineIndex = Math.floor(logicalY / lineHeight);
    const charIndex = Math.floor(Math.max(0, x - gutterWidth + scrollLeft) / charWidthRef.current);
    return { lineIndex, charIndex, x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getPosFromEvent(e);
    if (!pos) return;
    setSelection({ startLine: pos.lineIndex, startChar: pos.charIndex, endLine: pos.lineIndex, endChar: pos.charIndex });
    setIsSelecting(true);
    setContextMenu(null);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isSelecting) return;
    const pos = getPosFromEvent(e);
    if (!pos) return;
    setSelection(prev => prev ? { ...prev, endLine: pos.lineIndex, endChar: pos.charIndex } : null);
  }, [isSelecting, effectiveScrollTop]);

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

  // Custom wheel handler: normalize each tick to exactly 3 lines
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const linesToScroll = LOG_VIEWER.WHEEL_LINES_PER_TICK;
      const logicalDelta = Math.sign(e.deltaY) * linesToScroll * lineHeight;
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
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'g' && modifier && !e.shiftKey) {
        e.preventDefault();
        setShowGoToLine(true);
        return;
      }

      if (showGoToLine) return;

      if (e.key === 'l' && modifier && e.shiftKey) {
        e.preventDefault();
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
        return;
      }

      if (e.key === 'Enter' && modifier) {
        e.preventDefault();
        if (selection) {
          const norm = normalizeSelection(selection);
          onLineClick?.(norm.topLine);
        }
        return;
      }

      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
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
        return;
      }

      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
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
        return;
      }

      if (e.key === 'a' && modifier) {
        e.preventDefault();
        setSelection({
          startLine: 0,
          startChar: 0,
          endLine: totalLines - 1,
          endChar: 0
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGoToLine, hoveredLineIndex, highlightedIndex, selection, bridgedLines, totalLines, onLineClick]);

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
    }
  };

  // Double-click handler: select the word under cursor
  const handleDoubleClick = (e: React.MouseEvent) => {
    const pos = getPosFromEvent(e);
    if (!pos || pos.x < gutterWidth) return;

    const line = bridgedLines.get(pos.lineIndex);
    const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
    if (!content) return;

    // Find word boundaries (alphanumeric + underscore)
    const charIndex = pos.charIndex;
    let start = charIndex;
    let end = charIndex;

    // Expand left
    while (start > 0 && /[\w]/.test(content[start - 1])) {
      start--;
    }

    // Expand right
    while (end < content.length && /[\w]/.test(content[end])) {
      end++;
    }

    // Only select if we have a valid word
    if (end > start) {
      setSelection({
        startLine: pos.lineIndex,
        startChar: start,
        endLine: pos.lineIndex,
        endChar: end
      });
      setIsSelecting(false);
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

      // --- Draw Overview Ruler ---
      const effectiveRulerWidth = showRuler ? 12 : 0;
      const effectiveViewportWidth = viewportWidth - effectiveRulerWidth;

      if (showRuler) {
        const rulerWidth = 12;
        const rulerX = viewportWidth - rulerWidth;
        ctx.fillStyle = colors.BACKGROUND;
        ctx.fillRect(rulerX, 0, rulerWidth, viewportHeight);

        // Draw markers for layers/search
        Object.entries(layerStats).forEach(([id, stats]: [string, any]) => {
          const color = id === 'search' ? colors.SEARCH_HIGHLIGHT : colors.LAYER_HIGHLIGHT;
          ctx.fillStyle = color;
          stats.distribution.forEach((v: number, idx: number) => {
            if (v > 0) {
              const h = Math.max(2, v * (viewportHeight / 20));
              ctx.globalAlpha = 0.5;
              ctx.fillRect(rulerX + 2, idx * (viewportHeight / 20), rulerWidth - 4, h);
              ctx.globalAlpha = 1.0;
            }
          });
        });

        // Draw markers for bookmarks
        const bookmarkIndices = Object.keys(bookmarks).map(Number);
        if (bookmarkIndices.length > 0) {
          ctx.fillStyle = colors.BOOKMARK_INDICATOR;
          bookmarkIndices.forEach(idx => {
            const yPos = (idx / totalLines) * viewportHeight;
            ctx.fillRect(rulerX, yPos, rulerWidth, 2);
          });
        }

        // Draw viewport indicator in ruler (uses drawEffectiveScroll, not the outer effectiveScrollTop)
        const viewStart = (drawEffectiveScroll / realTotalHeight) * viewportHeight;
        const viewSize = (viewportHeight / realTotalHeight) * viewportHeight;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(rulerX, viewStart, rulerWidth, Math.max(5, viewSize));
      }

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
          } else {
            const linesRemaining = totalLines - endIndex;
            if (linesRemaining > 0) {
              ctx.fillText(`加载中... ${linesRemaining.toLocaleString()} 行`, centerX, centerY - 10);
            } else {
              ctx.fillText('Loading lines...', centerX, centerY);
            }
          }
          return;
        }
      } else {
        ctx.clearRect(0, 0, viewportWidth, viewportHeight);
        return;
      }

      const firstVisibleY = (startIndex - Math.floor(safeScrollTop / lineHeight)) * lineHeight;

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
        if (highlightedIndex === i) {
          // Current line highlight - use a more visible cyan tint
          ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        } else if (rowStyle?.backgroundColor) {
          ctx.fillStyle = rowStyle.backgroundColor;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        } else if (isMarked) {
          ctx.fillStyle = colors.BOOKMARK_BACKGROUND;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        } else if (!hasData) {
          // Loading placeholder - draw faint background to prevent transparency
          ctx.fillStyle = colors.BACKGROUND;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
        }

        // Selection highlight
        if (selection) {
          const norm = normalizeSelection(selection);
          if (i >= norm.topLine && i <= norm.bottomLine) {
            const { s, e } = getLineSelectionRange(i, norm, content.length);
            ctx.fillStyle = colors.SELECTION;
            ctx.fillRect(gutterWidth + s * charWidthRef.current - safeScrollLeft, y, (e - s) * charWidthRef.current, lineHeight);
          }
        }

        // Draw gutter and line numbers
        if (showLineNumbers) {
          ctx.fillStyle = colors.GUTTER;
          ctx.fillRect(0, y, gutterWidth - 5, lineHeight);

          const gutterFontSize = Math.max(10, fontSize - 2);
          ctx.font = `${gutterFontSize}px "JetBrains Mono", monospace`;
          ctx.fillStyle = highlightedIndex === i ? colors.CURRENT_LINE : colors.GUTTER_TEXT;
          ctx.textAlign = 'right';
          ctx.fillText((i + 1).toLocaleString(), gutterWidth - 15, y + lineHeight / 2 + 4);
        }

        if (isMarked) {
          ctx.fillStyle = colors.BOOKMARK_INDICATOR;
          ctx.textAlign = 'center';
          ctx.font = `${fontSize}px "JetBrains Mono"`;
          ctx.fillText(logLine?.bookmarkComment ? '★' : '●', 15, y + lineHeight / 2 + 4);

          ctx.fillStyle = colors.BOOKMARK_INDICATOR;
          ctx.fillRect(0, y, 2, lineHeight);
        }

        // 4. Content
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
          const highlightsToRender = searchHighlightAll ? logLine?.highlights : [];
          if (highlightsToRender && highlightsToRender.length > 0) {
            let lastIdx = 0;
            const sorted = [...highlightsToRender].sort((a, b) => a.start - b.start);
            sorted.forEach(h => {
              if (h.start > lastIdx) {
                ctx.fillStyle = colors.TEXT;
                ctx.fillText(text.substring(lastIdx, h.start), startX + lastIdx * charWidthRef.current, startY);
              }
              const opacity = (h.opacity || 100) / 100;
              const hText = text.substring(h.start, h.end);
              if (h.isSearch || h.color === '#facc15') {
                ctx.fillStyle = h.color;
                ctx.fillRect(startX + h.start * charWidthRef.current, startY - lineHeight / 2 + 2, hText.length * charWidthRef.current, lineHeight - 4);
                ctx.fillStyle = '#000';
              } else {
                ctx.fillStyle = h.color.startsWith('#') ? `${h.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}` : h.color;
              }
              ctx.fillText(hText, startX + h.start * charWidthRef.current, startY);
              lastIdx = h.end;
            });
            if (lastIdx < text.length) {
              ctx.fillStyle = colors.TEXT;
              ctx.fillText(text.substring(lastIdx), startX + lastIdx * charWidthRef.current, startY);
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
      }
    } catch (err) {
      console.error('Canvas draw error:', err);
    }
  }, [viewportWidth, viewportHeight, startIndex, endIndex, bridgedLines, selection, highlightedIndex, totalLines, layerStats, bookmarks, useScrollScaling, maxPhysicalScroll, maxLogicalScroll, lineHeight, showLineNumbers, showRuler, wordWrap, showWhitespace, fontSize, searchHighlightAll, settings]);

  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());

  useEffect(() => {
    const updatePerformanceStats = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastFpsUpdateRef.current;
      
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        const visibleLines = endIndex - startIndex;
        const memory = (performance as any).memory 
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) 
          : 0;
        
        setPerformanceStats({ fps, visibleLines, memory });
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }
    };

    const frame = requestAnimationFrame(() => {
      draw();
      updatePerformanceStats();
    });
    return () => cancelAnimationFrame(frame);
  }, [draw, startIndex, endIndex]);

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
        
        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate3d(${sl}px, ${st}px, 0)`;
        }
        setScrollTop(st);
        setScrollLeft(sl);
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Spacer in normal flow to create scrollable area */}
      <div style={{ height: virtualTotalHeight, width: maxLineWidth, pointerEvents: 'none' }} />

      {fileId && totalLines > 0 && viewportWidth > 0 && viewportHeight > 0 && (
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
              zIndex: 1
            }}
          />
        </ErrorBoundary>
      )}

      {contextMenu && createPortal(
        <div
          className="context-menu-popup fixed bg-theme-surface border border-theme-default shadow-2xl rounded py-1 min-w-[160px] z-[1000] text-[12px] select-none"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={e => e.stopPropagation()}
        >
          {contextMenu.text && (
            <>
              <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => { navigator.clipboard.writeText(contextMenu.text); setContextMenu(null); }}>复制选中内容</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => { onSendToAI?.(contextMenu.text); setContextMenu(null); }}>发送给 AI</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => { onAddLayer?.(LayerType.HIGHLIGHT, { query: contextMenu.text, color: '#facc15' }); setContextMenu(null); }}>以此高亮</button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => { onAddLayer?.(LayerType.FILTER, { query: contextMenu.text }); setContextMenu(null); }}>以此过滤</button>
              {detectJson(contextMenu.text).valid && (
                <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => { setExpandedJsonLine(contextMenu.lineIndex ?? null); setContextMenu(null); }}>展开 JSON</button>
              )}
              <div className="h-[1px] bg-theme-subtle my-1" />
            </>
          )}
          <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => { onToggleBookmark?.(contextMenu.lineIndex!); setContextMenu(null); }}>切换书签</button>
          <button className="w-full text-left px-3 py-1.5 hover:bg-blue-600 text-gray-200" onClick={() => {
            const line = bridgedLines.get(contextMenu.lineIndex!);
            navigator.clipboard.writeText(typeof line === 'string' ? line : (line as LogLine)?.content || '');
            setContextMenu(null);
          }}>复制整行</button>
        </div>,
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
