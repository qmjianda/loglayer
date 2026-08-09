/**
 * useContextMenu - Context menu state and handlers hook
 *
 * Manages context menu state for LogViewer.
 */

import { useState, useCallback } from 'react';

export interface ContextMenuState {
  x: number;
  y: number;
  text: string;
  lineIndex?: number;
}

export interface UseContextMenuOptions {
  onCopy?: (text: string) => void;
  onSendToAI?: (text: string) => void;
  onAddHighlight?: (query: string) => void;
  onAddFilter?: (query: string) => void;
  onToggleBookmark?: (lineIndex: number) => void;
  onCopyLine?: (lineIndex: number) => void;
  lines?: Map<number, any>;
}

export interface UseContextMenuReturn {
  contextMenu: ContextMenuState | null;
  openContextMenu: (x: number, y: number, text: string, lineIndex?: number) => void;
  closeContextMenu: () => void;
  handleCopy: () => void;
  handleSendToAI: () => void;
  handleAddHighlight: () => void;
  handleAddFilter: () => void;
  handleToggleBookmark: () => void;
  handleCopyLine: () => void;
}

export function useContextMenu(options: UseContextMenuOptions = {}): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const openContextMenu = useCallback((x: number, y: number, text: string, lineIndex?: number) => {
    setContextMenu({ x, y, text, lineIndex });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopy = useCallback(() => {
    if (contextMenu?.text && options.onCopy) {
      options.onCopy(contextMenu.text);
    }
    closeContextMenu();
  }, [contextMenu, options.onCopy, closeContextMenu]);

  const handleSendToAI = useCallback(() => {
    if (contextMenu?.text && options.onSendToAI) {
      options.onSendToAI(contextMenu.text);
    }
    closeContextMenu();
  }, [contextMenu, options.onSendToAI, closeContextMenu]);

  const handleAddHighlight = useCallback(() => {
    if (contextMenu?.text && options.onAddHighlight) {
      options.onAddHighlight(contextMenu.text);
    }
    closeContextMenu();
  }, [contextMenu, options.onAddHighlight, closeContextMenu]);

  const handleAddFilter = useCallback(() => {
    if (contextMenu?.text && options.onAddFilter) {
      options.onAddFilter(contextMenu.text);
    }
    closeContextMenu();
  }, [contextMenu, options.onAddFilter, closeContextMenu]);

  const handleToggleBookmark = useCallback(() => {
    if (contextMenu?.lineIndex !== undefined && options.onToggleBookmark) {
      options.onToggleBookmark(contextMenu.lineIndex);
    }
    closeContextMenu();
  }, [contextMenu, options.onToggleBookmark, closeContextMenu]);

  const handleCopyLine = useCallback(() => {
    if (contextMenu?.lineIndex !== undefined && options.onCopyLine) {
      options.onCopyLine(contextMenu.lineIndex);
    }
    closeContextMenu();
  }, [contextMenu, options.onCopyLine, closeContextMenu]);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleCopy,
    handleSendToAI,
    handleAddHighlight,
    handleAddFilter,
    handleToggleBookmark,
    handleCopyLine,
  };
}
