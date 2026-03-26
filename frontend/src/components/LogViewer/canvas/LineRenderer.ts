/**
 * Line Renderer - Pure functions for rendering single log lines on canvas
 * Extracted from LogViewer.tsx for better separation of concerns
 */

import { RowStyle, LogLine } from '../../../types';

/**
 * Color scheme interface for LogViewer
 */
export interface LogViewerColors {
  BACKGROUND: string;
  TEXT: string;
  GUTTER: string;
  GUTTER_TEXT: string;
  GUTTER_SEPARATOR: string;
  SELECTION: string;
  HIGHLIGHT_LINE: string;
  CURRENT_LINE: string;
  HOVER_LINE: string;
  BOOKMARK_BACKGROUND: string;
  BOOKMARK_INDICATOR: string;
  JUMP_PULSE: string;
  JUMP_PULSE_BORDER: string;
  WORD_HIGHLIGHT: string;
  SEARCH_HIGHLIGHT: string;
  SEARCH_HIGHLIGHT_ACTIVE: string;
  LAYER_HIGHLIGHT: string;
  CONTEXT_MENU: string;
  CONTEXT_MENU_BORDER: string;
}

/**
 * Selection range definition
 */
export interface Selection {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

/**
 * Normalized selection with top-to-bottom order
 */
export interface NormalizedSelection {
  topLine: number;
  topChar: number;
  bottomLine: number;
  bottomChar: number;
}

/**
 * Highlight segment for text rendering
 */
export interface HighlightSegment {
  start: number;
  end: number;
  color: string;
  opacity: number;
  isSearch?: boolean;
}

/**
 * Parameters for rendering a single line
 */
export interface RenderLineParams {
  // Canvas context
  ctx: CanvasRenderingContext2D;
  
  // Line data
  lineIndex: number;
  content: string;
  logLine: LogLine | null;
  
  // Positioning
  y: number;
  lineHeight: number;
  viewportWidth: number;
  effectiveViewportWidth: number;
  effectiveRulerWidth: number;
  gutterWidth: number;
  showLineNumbers: boolean;
  safeScrollLeft: number;
  charWidthRef: { current: number };
  
  // Appearance
  font: string;
  fontSize: number;
  colors: LogViewerColors;
  showWhitespace: boolean;
  wordWrap: boolean;
  
  // State
  highlightedIndex: number;
  hoveredLineIndex: number;
  jumpPulseIndex: number;
  isSelecting: boolean;
  selection: Selection | null;
  highlightedWord: string | null;
  searchHighlightAll: boolean;
}

/**
 * Normalize selection to top-to-bottom order regardless of drag direction.
 * Returns { topLine, topChar, topChar, bottomLine, bottomChar }.
 */
export function normalizeSelection(sel: Selection): NormalizedSelection {
  const { startLine, startChar, endLine, endChar } = sel;
  
  if (startLine < endLine || (startLine === endLine && startChar <= endChar)) {
    return {
      topLine: startLine,
      topChar: startChar,
      bottomLine: endLine,
      bottomChar: endChar,
    };
  }
  
  return {
    topLine: endLine,
    topChar: endChar,
    bottomLine: startLine,
    bottomChar: startChar,
  };
}

/**
 * Get the character range [s, e) for a given line index within a normalized selection.
 */
export function getLineSelectionRange(
  lineIndex: number,
  norm: NormalizedSelection,
  contentLength: number
): { s: number; e: number } {
  if (lineIndex === norm.topLine && lineIndex === norm.bottomLine) {
    // Selection within single line
    return { s: norm.topChar, e: norm.bottomChar };
  }
  
  if (lineIndex === norm.topLine) {
    // First line of multi-line selection
    return { s: norm.topChar, e: contentLength };
  }
  
  if (lineIndex === norm.bottomLine) {
    // Last line of multi-line selection
    return { s: 0, e: norm.bottomChar };
  }
  
  // Middle line (full line selected)
  return { s: 0, e: contentLength };
}

/**
 * Render the background layer for a single line.
 * Handles: jump pulse, current line highlight, row style, bookmark background, hover, loading
 */
function renderBackground(params: RenderLineParams): void {
  const { ctx, lineIndex, y, lineHeight, effectiveViewportWidth, colors } = params;
  
  const rowStyle = params.logLine?.rowStyle;
  const hasData = params.logLine !== undefined && params.logLine !== null;
  const isMarked = params.logLine?.isMarked;
  
  // Jump pulse effect (animated border)
  if (params.jumpPulseIndex === lineIndex) {
    ctx.fillStyle = colors.JUMP_PULSE;
    ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
    ctx.strokeStyle = colors.JUMP_PULSE_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y, effectiveViewportWidth, lineHeight);
    return;
  }
  
  // Current line highlight
  if (params.highlightedIndex === lineIndex) {
    ctx.fillStyle = colors.HIGHLIGHT_LINE;
    ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
    // Left indicator bar for current line
    ctx.fillStyle = colors.CURRENT_LINE;
    ctx.fillRect(0, y, 3, lineHeight);
    return;
  }
  
  // Custom row style (from layers)
  if (rowStyle?.backgroundColor) {
    ctx.fillStyle = rowStyle.backgroundColor;
    ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
    return;
  }
  
  // Bookmark background with subtle gradient
  if (isMarked) {
    const grad = ctx.createLinearGradient(0, y, effectiveViewportWidth * 0.5, y);
    grad.addColorStop(0, colors.BOOKMARK_BACKGROUND);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
    return;
  }
  
  // Hover highlight
  if (params.hoveredLineIndex === lineIndex && !params.isSelecting) {
    ctx.fillStyle = colors.HOVER_LINE;
    ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
    return;
  }
  
  // Loading placeholder
  if (!hasData) {
    ctx.fillStyle = colors.BACKGROUND;
    ctx.fillRect(0, y, effectiveViewportWidth, lineHeight);
  }
}

/**
 * Render selection highlight for a single line
 */
function renderSelection(params: RenderLineParams): void {
  const { ctx, lineIndex, content, y, lineHeight, selection, colors, gutterWidth, safeScrollLeft } = params;
  
  if (!selection) return;
  
  const norm = normalizeSelection(selection);
  
  if (lineIndex < norm.topLine || lineIndex > norm.bottomLine) {
    return; // Line not in selection
  }
  
  // Create a local measureSubstringWidth using ctx for this function
  const measureSubstringWidth = (text: string, start: number, end: number): number => {
    if (start >= end) return 0;
    return ctx.measureText(text.substring(start, end)).width;
  };
  
  const { s, e } = getLineSelectionRange(lineIndex, norm, content.length);
  
  if (s >= e) return;
  
  const selX = measureSubstringWidth(content, 0, s);
  const selW = measureSubstringWidth(content, s, e);
  
  ctx.fillStyle = colors.SELECTION;
  ctx.fillRect(gutterWidth + selX - safeScrollLeft, y, selW, lineHeight);
}

/**
 * Render text content with highlights for a single line
 */
function renderText(params: RenderLineParams): void {
  const {
    ctx, lineIndex, content, logLine, y, lineHeight, viewportWidth,
    font, showLineNumbers, showWhitespace, wordWrap, charWidthRef,
    effectiveRulerWidth, safeScrollLeft, colors, highlightedWord, searchHighlightAll
  } = params;
  
  ctx.save();
  ctx.beginPath();
  
  // Clip to content area
  const contentLeftX = showLineNumbers ? params.gutterWidth : 0;
  ctx.rect(contentLeftX, y, viewportWidth - contentLeftX, lineHeight);
  ctx.clip();
  
  ctx.font = font;
  ctx.textAlign = 'left';
  
  const contentX = showLineNumbers ? (params.gutterWidth - safeScrollLeft) : (-safeScrollLeft);
  const effectiveGutterWidth = showLineNumbers ? params.gutterWidth : 0;
  const maxCharsPerLine = Math.floor(
    (viewportWidth - effectiveRulerWidth - effectiveGutterWidth) / charWidthRef.current
  );
  
  // Apply whitespace rendering if enabled
  let displayContent = content;
  if (showWhitespace) {
    displayContent = content
      .replace(/ /g, '\u00B7')
      .replace(/\t/g, '\u2192 ');
  }
  
  // Use measureSubstringWidth from the original context
  const measureSubstringWidth = (text: string, start: number, end: number): number => {
    if (start >= end) return 0;
    return ctx.measureText(text.substring(start, end)).width;
  };
  
  /**
   * Render text with highlights (nested function for closure access)
   */
  const renderTextWithHighlights = (text: string, startX: number, startY: number): void => {
    const allHighlights: HighlightSegment[] = [];
    
    // Add search highlights
    if (searchHighlightAll && logLine?.highlights) {
      allHighlights.push(...logLine.highlights);
    }
    
    // Add word highlights
    if (highlightedWord && highlightedWord.length >= 2) {
      const wordRegex = new RegExp(
        `\\b${highlightedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'g'
      );
      let match;
      while ((match = wordRegex.exec(text)) !== null) {
        const existing = allHighlights.find(
          h => h.start === match!.index && h.end === match!.index + match![0].length
        );
        if (!existing) {
          allHighlights.push({
            start: match.index,
            end: match.index + match[0].length,
            color: colors.WORD_HIGHLIGHT,
            opacity: 100,
            isSearch: false,
          });
        }
      }
    }
    
    if (allHighlights.length > 0) {
      let lastIdx = 0;
      const sorted = [...allHighlights].sort((a, b) => a.start - b.start);
      
      sorted.forEach((h) => {
        if (h.start > lastIdx) {
          ctx.fillStyle = colors.TEXT;
          const segX = startX + measureSubstringWidth(text, 0, lastIdx);
          ctx.fillText(text.substring(lastIdx, h.start), segX, startY);
        }
        
        const opacity = (h.opacity || 100) / 100;
        const hText = text.substring(h.start, h.end);
        const hlPixelX = startX + measureSubstringWidth(text, 0, h.start);
        
        if (h.isSearch || h.color === '#facc15') {
          // Search highlight with rounded rectangle
          const hlW = measureSubstringWidth(text, h.start, h.end);
          const hlY = y;
          const hlH = lineHeight;
          ctx.fillStyle = h.color;
          ctx.beginPath();
          ctx.roundRect(hlPixelX, hlY, hlW, hlH, 2);
          ctx.fill();
          ctx.fillStyle = '#000';
        } else {
          // Layer highlight with semi-transparent background
          const hlW = measureSubstringWidth(text, h.start, h.end);
          const hlY = y;
          const hlH = lineHeight;
          ctx.fillStyle = h.color.startsWith('#')
            ? `${h.color}${Math.floor(opacity * 255).toString(16).padStart(2, '0')}`
            : h.color;
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
      // No highlights - use row style color if available
      ctx.fillStyle = logLine?.rowStyle?.color || colors.TEXT;
      ctx.fillText(text, startX, startY);
    }
  };
  
  // Render with word wrap or single line
  if (wordWrap && maxCharsPerLine > 0) {
    const lines: string[] = [];
    for (let i = 0; i < displayContent.length; i += maxCharsPerLine) {
      lines.push(displayContent.substring(i, i + maxCharsPerLine));
    }
    lines.forEach((lineText, lineIdx) => {
      renderTextWithHighlights(lineText, contentX, y + lineHeight / 2 + 4 + lineIdx * lineHeight);
    });
  } else {
    renderTextWithHighlights(displayContent, contentX, y + lineHeight / 2 + 4);
  }
  
  ctx.restore();
}

/**
 * Render the gutter (line numbers) for a single line
 */
function renderGutter(params: RenderLineParams): void {
  const { ctx, lineIndex, y, lineHeight, colors, fontSize, gutterWidth, showLineNumbers } = params;
  
  if (!showLineNumbers) return;
  
  // Gutter background
  ctx.fillStyle = colors.GUTTER;
  ctx.fillRect(0, y, gutterWidth, lineHeight);
  
  // Gutter separator line
  ctx.fillStyle = colors.GUTTER_SEPARATOR;
  ctx.fillRect(gutterWidth - 1, y, 1, lineHeight);
  
  // Line number text
  const gutterFontSize = Math.max(10, fontSize - 2);
  ctx.font = `${gutterFontSize}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'middle';
  
  // Color based on state
  if (params.highlightedIndex === lineIndex) {
    ctx.fillStyle = colors.CURRENT_LINE;
  } else if (params.hoveredLineIndex === lineIndex) {
    ctx.fillStyle = colors.TEXT;
  } else {
    ctx.fillStyle = colors.GUTTER_TEXT;
  }
  
  ctx.textAlign = 'right';
  ctx.fillText(
    (lineIndex + 1).toLocaleString(),
    gutterWidth - 15,
    y + lineHeight / 2
  );
  ctx.textBaseline = 'alphabetic';
}

/**
 * Render the bookmark icon for a single line
 */
function renderBookmark(params: RenderLineParams): void {
  const { ctx, lineIndex, y, lineHeight, logLine, colors } = params;
  
  const isMarked = logLine?.isMarked;
  if (!isMarked) return;
  
  const hasComment = logLine?.bookmarkComment;
  
  // Bookmark icon position
  const iconX = 15;
  const iconY = y + lineHeight / 2;
  
  ctx.fillStyle = colors.BOOKMARK_INDICATOR;
  
  if (hasComment) {
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

/**
 * Main entry point: Render a complete single line with all elements
 * Renders in order: background -> selection -> text -> gutter -> bookmark
 * 
 * @param params - All parameters needed for rendering
 */
export function renderLine(params: RenderLineParams): void {
  renderBackground(params);
  renderSelection(params);
  renderText(params);
  renderGutter(params);
  renderBookmark(params);
}