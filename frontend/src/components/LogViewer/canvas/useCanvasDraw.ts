/**
 * useCanvasDraw Hook
 * 
 * Canvas drawing logic with requestAnimationFrame scheduling and performance monitoring.
 * High-DPI support included.
 * 
 * Extracted from LogViewer.tsx lines 647-969
 */

import { useCallback, useEffect, useRef } from 'react';

/**
 * Colors object from theme
 */
export interface LogViewerColors {
  BACKGROUND: string;
  GUTTER: string;
  GUTTER_TEXT: string;
  GUTTER_SEPARATOR: string;
  HIGHLIGHT_LINE: string;
  HOVER_LINE: string;
  BOOKMARK_BACKGROUND: string;
  BOOKMARK_INDICATOR: string;
  SELECTION: string;
  TEXT: string;
  RULER: string;
  RULER_SEPARATOR: string;
  RULER_VIEWPORT: string;
  SEARCH_HIGHLIGHT: string;
  SEARCH_HIGHLIGHT_ACTIVE: string;
  LAYER_HIGHLIGHT: string;
  WORD_HIGHLIGHT: string;
  CURRENT_LINE: string;
  JUMP_PULSE: string;
  JUMP_PULSE_BORDER: string;
  CONTEXT_MENU: string;
  CONTEXT_MENU_BORDER: string;
}

/**
 * Log line structure used in canvas rendering
 */
interface CanvasLogLine {
  index: number;
  content: string;
  displayContent?: string;
  highlights?: Array<{
    start: number;
    end: number;
    color: string;
    opacity: number;
    isSearch?: boolean;
  }>;
  isMarked?: boolean;
  bookmarkComment?: string;
  rowStyle?: {
    backgroundColor?: string;
    color?: string;
  };
}

/**
 * Selection state
 */
interface Selection {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

/**
 * Performance stats for display
 */
export interface PerformanceStats {
  fps: number;
  visibleLines: number;
  memory: number;
}

/**
 * Props for useCanvasDraw hook
 */
export interface UseCanvasDrawParams {
  /** Canvas element ref */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Container element ref for scroll position */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
  /** Visible line range */
  startIndex: number;
  endIndex: number;
  /** Scroll position */
  scrollTop: number;
  scrollLeft: number;
  /** Log data */
  bridgedLines: Map<number, CanvasLogLine | string>;
  totalLines: number;
  /** Selection state */
  selection: Selection | null;
  isSelecting: boolean;
  /** Highlight states */
  highlightedIndex: number | null;
  hoveredLineIndex: number;
  /** Line height and font */
  lineHeight: number;
  font: string;
  fontSize: number;
  charWidthRef: React.MutableRefObject<number>;
  /** Display options */
  showLineNumbers: boolean;
  wordWrap: boolean;
  showWhitespace: boolean;
  gutterWidth: number;
  /** Theme colors */
  colors: LogViewerColors;
  /** Search highlights */
  searchHighlightAll: boolean;
  highlightedWord: string;
  /** Scroll scaling */
  useScrollScaling: boolean;
  maxPhysicalScroll: number;
  maxLogicalScroll: number;
  /** Special states */
  isIndexing: boolean;
  isSearching: boolean;
  indexingProgress: number;
  jumpPulseIndex: number;
  /** Callback for performance stats update */
  onPerformanceStatsUpdate?: (stats: PerformanceStats) => void;
  /** Measurement function */
  measureSubstringWidth: (text: string, start: number, end: number) => number;
}

/**
 * Normalize selection to top-to-bottom order regardless of drag direction.
 */
function normalizeSelection(sel: Selection): { topLine: number; topChar: number; bottomLine: number; bottomChar: number } {
  if (sel.startLine < sel.endLine || (sel.startLine === sel.endLine && sel.startChar <= sel.endChar)) {
    return { topLine: sel.startLine, topChar: sel.startChar, bottomLine: sel.endLine, bottomChar: sel.endChar };
  }
  return { topLine: sel.endLine, topChar: sel.endChar, bottomLine: sel.startLine, bottomChar: sel.startChar };
}

/**
 * Get the character range [s, e) for a given line index within a normalized selection.
 */
function getLineSelectionRange(i: number, norm: ReturnType<typeof normalizeSelection>, contentLength: number): { s: number; e: number } {
  let s = 0, e = contentLength;
  if (norm.topLine === norm.bottomLine) {
    s = norm.topChar;
    e = norm.bottomChar;
  } else if (i === norm.topLine) {
    s = norm.topChar;
  } else if (i === norm.bottomLine) {
    e = norm.bottomChar;
  }
  return { s, e };
}

/**
 * Custom hook for canvas drawing with performance monitoring
 * 
 * @param params - All required parameters for canvas rendering
 * @returns Object containing the draw function
 */
export function useCanvasDraw({
  canvasRef,
  containerRef,
  viewportWidth,
  viewportHeight,
  startIndex,
  endIndex,
  scrollTop,
  scrollLeft,
  bridgedLines,
  totalLines,
  selection,
  isSelecting,
  highlightedIndex,
  hoveredLineIndex,
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
  highlightedWord,
  useScrollScaling,
  maxPhysicalScroll,
  maxLogicalScroll,
  isIndexing,
  isSearching,
  indexingProgress,
  jumpPulseIndex,
  onPerformanceStatsUpdate,
  measureSubstringWidth,
}: UseCanvasDrawParams) {
  // Performance monitoring refs
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());
  const lastDrawDepsRef = useRef<string>('');

  /**
   * Main draw function - renders all visible lines to canvas
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !Number.isFinite(viewportWidth) || viewportWidth <= 0 || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    try {
      // High-DPI support
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

      // Only fill background when there's data
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
        const logLine = isLogLine ? (line as CanvasLogLine) : null;
        const content = typeof line === 'string' ? line : logLine?.content || '';
        const isMarked = logLine?.isMarked;

        // 1. Backgrounds
        const rowStyle = logLine?.rowStyle;
        const hasData = line !== undefined;
        
        if (jumpPulseIndex === i) {
          ctx.fillStyle = colors.JUMP_PULSE;
          ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
          ctx.strokeStyle = colors.JUMP_PULSE_BORDER;
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
  }, [
    canvasRef,
    containerRef,
    viewportWidth,
    viewportHeight,
    startIndex,
    endIndex,
    bridgedLines,
    selection,
    highlightedIndex,
    hoveredLineIndex,
    isSelecting,
    totalLines,
    lineHeight,
    showLineNumbers,
    wordWrap,
    showWhitespace,
    fontSize,
    searchHighlightAll,
    colors,
    jumpPulseIndex,
    useScrollScaling,
    maxPhysicalScroll,
    maxLogicalScroll,
    gutterWidth,
    charWidthRef,
    font,
    measureSubstringWidth,
    isIndexing,
    isSearching,
    indexingProgress,
    highlightedWord,
  ]);

  /**
   * requestAnimationFrame scheduling with performance monitoring
   */
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
        const memory = (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : 0;

        onPerformanceStatsUpdate?.({ fps, visibleLines, memory });
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
  }, [
    draw,
    startIndex,
    endIndex,
    scrollTop,
    scrollLeft,
    highlightedIndex,
    hoveredLineIndex,
    selection,
    bridgedLines.size,
    highlightedWord,
    onPerformanceStatsUpdate,
  ]);

  return { draw };
}

export default useCanvasDraw;