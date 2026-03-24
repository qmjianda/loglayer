/**
 * Selection Hook
 * 
 * Extracts selection handling, mouse events, and copy behavior from LogViewer.tsx
 * for better separation of concerns and testability.
 * 
 * Original code: LogViewer.tsx lines 344-646
 */

import { useCallback, useEffect } from 'react';
import { useShortcut } from '../../../shortcuts/useShortcut';

export interface SelectionState {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface SelectionPosition {
  lineIndex: number;
  charIndex: number;
  x: number;
  y: number;
  isInside: boolean;
}

/**
 * Normalize selection to top-to-bottom order regardless of drag direction.
 * Returns { topLine, topChar, bottomLine, bottomChar }.
 */
export function normalizeSelection(sel: SelectionState): {
  topLine: number;
  topChar: number;
  bottomLine: number;
  bottomChar: number;
} {
  if (sel.startLine < sel.endLine || (sel.startLine === sel.endLine && sel.startChar <= sel.endChar)) {
    return {
      topLine: sel.startLine,
      topChar: sel.startChar,
      bottomLine: sel.endLine,
      bottomChar: sel.endChar,
    };
  }
  return {
    topLine: sel.endLine,
    topChar: sel.endChar,
    bottomLine: sel.startLine,
    bottomChar: sel.startChar,
  };
}

/**
 * Get the character range [s, e) for a given line index within a normalized selection.
 */
export function getLineSelectionRange(
  i: number,
  norm: { topLine: number; topChar: number; bottomLine: number; bottomChar: number },
  contentLength: number
): { s: number; e: number } {
  if (i === norm.topLine && i === norm.bottomLine) {
    return { s: norm.topChar, e: Math.min(norm.bottomChar, contentLength) };
  }
  if (i === norm.topLine) {
    return { s: norm.topChar, e: contentLength };
  }
  if (i === norm.bottomLine) {
    return { s: 0, e: Math.min(norm.bottomChar, contentLength) };
  }
  return { s: 0, e: contentLength };
}

export interface UseSelectionParams {
  containerRef: React.RefObject<HTMLElement | null>;
  lineHeight: number;
  gutterWidth: number;
  scrollLeft: number;
  totalLines: number;
  bridgedLines: Map<number, string | { index: number; content: string; displayContent?: string; highlights?: unknown[]; isMarked?: boolean; bookmarkComment?: string }>;
  charIndexFromX: (text: string, pixelOffset: number) => number;
  effectiveScrollTop: number;
  selection: SelectionState | null;
  setSelection: React.Dispatch<React.SetStateAction<SelectionState | null>>;
  isSelecting: boolean;
  setIsSelecting: React.Dispatch<React.SetStateAction<boolean>>;
  hoveredLineIndex: number | null;
  setHoveredLineIndex: React.Dispatch<React.SetStateAction<number | null>>;
  highlightedIndex: number | null;
  onLineClick?: (lineIndex: number) => void;
  onSelectedTextChange?: (text: string) => void;
  setHighlightedWord?: (word: string | null) => void;
}

export interface UseSelectionReturn {
  getPosFromEvent: (e: MouseEvent | React.MouseEvent) => SelectionPosition | null;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleDoubleClick: (e: React.MouseEvent) => void;
}

/**
 * Hook for managing text selection in LogViewer.
 * Handles mouse events, double-click word selection, shortcuts, copy events, and selectedText reporting.
 */
export function useSelection(params: UseSelectionParams): UseSelectionReturn {
  const {
    containerRef,
    lineHeight,
    gutterWidth,
    scrollLeft,
    totalLines,
    bridgedLines,
    charIndexFromX,
    effectiveScrollTop,
    selection,
    setSelection,
    isSelecting,
    setIsSelecting,
    hoveredLineIndex,
    setHoveredLineIndex,
    highlightedIndex,
    onLineClick,
    onSelectedTextChange,
    setHighlightedWord,
  } = params;

  const getPosFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent): SelectionPosition | null => {
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
      const lineContent = typeof line === 'string' ? line : (line as { content: string })?.content || '';
      const charIndex = charIndexFromX(lineContent, pixelOffset);
      return { lineIndex, charIndex, x, y, isInside };
    },
    [containerRef, effectiveScrollTop, gutterWidth, scrollLeft, bridgedLines, charIndexFromX, lineHeight]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const pos = getPosFromEvent(e);
      if (!pos || !pos.isInside) return;

      setSelection({
        startLine: pos.lineIndex,
        startChar: pos.charIndex,
        endLine: pos.lineIndex,
        endChar: pos.charIndex,
      });
      setIsSelecting(true);
    },
    [getPosFromEvent, setSelection, setIsSelecting]
  );

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
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
      setSelection((prev) =>
        prev ? { ...prev, endLine: pos.lineIndex, endChar: pos.charIndex } : null
      );
    },
    [isSelecting, getPosFromEvent, totalLines, setHoveredLineIndex, setSelection]
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, [setIsSelecting]);

  // Set up global mouse event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Double-click handler: select the word under cursor
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const pos = getPosFromEvent(e);
      if (!pos || pos.x < gutterWidth) return;

      const line = bridgedLines.get(pos.lineIndex);
      const content = typeof line === 'string' ? line : (line as { content: string })?.content || '';
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
          endChar: end,
        });
        setIsSelecting(false);

        const selectedWord = content.substring(start, end);
        if (selectedWord.length >= 2 && setHighlightedWord) {
          setHighlightedWord(selectedWord);
        }
      }
    },
    [getPosFromEvent, gutterWidth, bridgedLines, setSelection, setIsSelecting, setHighlightedWord]
  );

  // Shortcut handlers
  useShortcut(
    'selectLine',
    useCallback(() => {
      const targetIndex = hoveredLineIndex ?? highlightedIndex;
      if (targetIndex !== null) {
        const line = bridgedLines.get(targetIndex);
        const content = typeof line === 'string' ? line : (line as { content: string })?.content || '';
        setSelection({
          startLine: targetIndex,
          startChar: 0,
          endLine: targetIndex,
          endChar: content.length,
        });
      }
    }, [hoveredLineIndex, highlightedIndex, bridgedLines, setSelection])
  );

  useShortcut(
    'jumpToSelection',
    useCallback(() => {
      if (selection) {
        const norm = normalizeSelection(selection);
        onLineClick?.(norm.topLine);
      }
    }, [selection, onLineClick])
  );

  useShortcut(
    'moveSelectionUp',
    useCallback(() => {
      if (selection) {
        const norm = normalizeSelection(selection);
        const newTopLine = Math.max(0, norm.topLine - 1);
        const newBottomLine = Math.max(0, norm.bottomLine - 1);
        setSelection({
          startLine: newTopLine,
          startChar: norm.topChar,
          endLine: newBottomLine,
          endChar: norm.bottomChar,
        });
      }
    }, [selection, setSelection])
  );

  useShortcut(
    'moveSelectionDown',
    useCallback(() => {
      if (selection) {
        const norm = normalizeSelection(selection);
        const newTopLine = Math.min(totalLines - 1, norm.topLine + 1);
        const newBottomLine = Math.min(totalLines - 1, norm.bottomLine + 1);
        setSelection({
          startLine: newTopLine,
          startChar: norm.topChar,
          endLine: newBottomLine,
          endChar: norm.bottomChar,
        });
      }
    }, [selection, totalLines, setSelection])
  );

  useShortcut(
    'selectAll',
    useCallback(() => {
      setSelection({
        startLine: 0,
        startChar: 0,
        endLine: totalLines - 1,
        endChar: 0,
      });
    }, [totalLines, setSelection])
  );

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
      const content = typeof line === 'string' ? line : (line as { content: string })?.content || '';
      const { s, e } = getLineSelectionRange(i, norm, content.length);
      text += content.substring(s, e) + (i === norm.bottomLine ? '' : '\n');
    }
    onSelectedTextChange(text.trim());
  }, [selection, bridgedLines, onSelectedTextChange]);

  // Copy event handler
  useEffect(() => {
    const handleCopyEvent = (e: ClipboardEvent) => {
      // If we have a selection, use our calculated text for native copy
      if (selection) {
        let selectedText = '';
        const norm = normalizeSelection(selection);

        for (let i = norm.topLine; i <= norm.bottomLine; i++) {
          const line = bridgedLines.get(i);
          const text = typeof line === 'string' ? line : (line as { content: string })?.content || '';
          const { s, e: e2 } = getLineSelectionRange(i, norm, text.length);
          selectedText += text.substring(s, e2) + (i === norm.bottomLine ? '' : '\n');
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

  return {
    getPosFromEvent,
    handleMouseDown,
    handleDoubleClick,
  };
}