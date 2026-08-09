/**
 * useSelection - Selection state and operations hook
 *
 * Manages text selection in LogViewer with normalization and clipboard support.
 */

import { useState, useCallback, useEffect } from 'react';
import { LogLine } from '../types';

export interface Selection {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface NormalizedSelection {
  topLine: number;
  topChar: number;
  bottomLine: number;
  bottomChar: number;
}

export interface UseSelectionOptions {
  lines: Map<number, LogLine | string>;
  onSelectedTextChange?: (text: string) => void;
}

export interface UseSelectionReturn {
  selection: Selection | null;
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
  isSelecting: boolean;
  setIsSelecting: (selecting: boolean) => void;
  normalizeSelection: (sel: Selection) => NormalizedSelection;
  getSelectedText: (selection: Selection | null) => string;
  copyToClipboard: (text: string) => Promise<void>;
}

export function useSelection({
  lines,
  onSelectedTextChange,
}: UseSelectionOptions): UseSelectionReturn {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Normalize selection to top-to-bottom order
  const normalizeSelection = useCallback((sel: Selection): NormalizedSelection => {
    if (
      sel.startLine < sel.endLine ||
      (sel.startLine === sel.endLine && sel.startChar <= sel.endChar)
    ) {
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
  }, []);

  // Get character range for a specific line within a normalized selection
  const getLineSelectionRange = useCallback(
    (
      lineIndex: number,
      norm: NormalizedSelection,
      contentLength: number,
    ): { s: number; e: number } => {
      let s = 0,
        e = contentLength;
      if (norm.topLine === norm.bottomLine) {
        s = norm.topChar;
        e = norm.bottomChar;
      } else if (lineIndex === norm.topLine) {
        s = norm.topChar;
      } else if (lineIndex === norm.bottomLine) {
        e = norm.bottomChar;
      }
      return { s, e };
    },
    [],
  );

  // Get full selected text from a selection
  const getSelectedText = useCallback(
    (sel: Selection | null): string => {
      if (!sel) return '';

      const norm = normalizeSelection(sel);
      if (norm.topLine === norm.bottomLine && norm.topChar === norm.bottomChar) {
        return '';
      }

      let text = '';
      for (let i = norm.topLine; i <= norm.bottomLine; i++) {
        const line = lines.get(i);
        const content = typeof line === 'string' ? line : (line as LogLine)?.content || '';
        const { s, e } = getLineSelectionRange(i, norm, content.length);
        text += content.substring(s, e) + (i === norm.bottomLine ? '' : '\n');
      }
      return text.trim();
    },
    [lines, normalizeSelection, getLineSelectionRange],
  );

  // Copy text to clipboard
  const copyToClipboard = useCallback(async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('[useSelection] Failed to copy:', err);
    }
  }, []);

  // Report selected text to parent for Ctrl+F auto-fill etc.
  useEffect(() => {
    if (!onSelectedTextChange) return;

    const text = getSelectedText(selection);
    onSelectedTextChange(text);
  }, [selection, getSelectedText, onSelectedTextChange]);

  // Handle native copy event
  useEffect(() => {
    const handleCopyEvent = (e: ClipboardEvent) => {
      if (!selection) return;

      const text = getSelectedText(selection);
      if (text) {
        e.clipboardData?.setData('text/plain', text);
        e.preventDefault();
      }
    };

    window.addEventListener('copy', handleCopyEvent);
    return () => window.removeEventListener('copy', handleCopyEvent);
  }, [selection, getSelectedText]);

  return {
    selection,
    setSelection,
    isSelecting,
    setIsSelecting,
    normalizeSelection,
    getSelectedText,
    copyToClipboard,
  };
}
