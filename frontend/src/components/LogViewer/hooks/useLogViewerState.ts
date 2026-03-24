/**
 * LogViewer State Management Hook
 * 
 * Extracts all useState hooks from LogViewer.tsx into a separate hook
 * for better separation of concerns and testability.
 */

import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * Log line interface mirroring backend LogLine
 */
export interface LogLine {
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
    bgColor?: string;
    textColor?: string;
  };
}

/**
 * Scroll-related state
 */
export interface ScrollState {
  scrollTop: number;
  scrollLeft: number;
  viewportHeight: number;
  viewportWidth: number;
  maxLineWidth: number;
}

/**
 * UI-related state (menus, popovers, panels)
 */
export interface UIState {
  contextMenu: { x: number; y: number; text: string; lineIndex?: number } | null;
  commentPopover: { x: number; y: number; lineIndex: number; comment: string } | null;
  expandedJsonLine: number | null;
  showGoToLine: boolean;
  showPerformancePanel: boolean;
  performanceStats: {
    fps: number;
    visibleLines: number;
    memory: number;
  };
}

/**
 * Selection-related state
 */
export interface SelectionState {
  selection: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  } | null;
  isSelecting: boolean;
  hoveredLineIndex: number | null;
  highlightedWord: string | null;
}

/**
 * Data-related state
 */
export interface DataState {
  bridgedLines: Map<number, LogLine | string>;
  jumpPulseIndex: number | null;
}

/**
 * Complete LogViewer state
 */
export interface LogViewerState extends ScrollState, UIState, SelectionState, DataState {}

/**
 * Scroll actions
 */
export interface ScrollActions {
  setScrollTop: (value: number | ((prev: number) => number)) => void;
  setScrollLeft: (value: number | ((prev: number) => number)) => void;
  setViewportHeight: (value: number | ((prev: number) => number)) => void;
  setViewportWidth: (value: number | ((prev: number) => number)) => void;
  setMaxLineWidth: (value: number | ((prev: number) => number)) => void;
}

/**
 * UI actions
 */
export interface UIActions {
  setContextMenu: (value: { x: number; y: number; text: string; lineIndex?: number } | null) => void;
  setCommentPopover: (value: { x: number; y: number; lineIndex: number; comment: string } | null) => void;
  setExpandedJsonLine: (value: number | null) => void;
  setShowGoToLine: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowPerformancePanel: (value: boolean | ((prev: boolean) => boolean)) => void;
  setPerformanceStats: (value: { fps: number; visibleLines: number; memory: number }) => void;
}

/**
 * Selection actions
 */
export interface SelectionActions {
  setSelection: (value: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  } | null) => void;
  setIsSelecting: (value: boolean | ((prev: boolean) => boolean)) => void;
  setHoveredLineIndex: (value: number | null) => void;
  setHighlightedWord: (value: string | null) => void;
}

/**
 * Data actions
 */
export interface DataActions {
  setBridgedLines: (value: Map<number, LogLine | string>) => void;
  setJumpPulseIndex: (value: number | null) => void;
  updateBookmarks: (bookmarks: Record<number, string>) => void;
}

/**
 * Complete LogViewer actions
 */
export interface LogViewerActions extends ScrollActions, UIActions, SelectionActions, DataActions {}

/**
 * Refs for mutable values that don't need re-renders
 */
export interface LogViewerRefs {
  lastFetchRef: React.MutableRefObject<{ start: number; end: number }>;
  scrollVelocityRef: React.MutableRefObject<number>;
  scrollDirectionRef: React.MutableRefObject<'up' | 'down' | null>;
  lastScrollTimeRef: React.MutableRefObject<number>;
  lastScrollTopRef: React.MutableRefObject<number>;
}

/**
 * Custom hook for LogViewer state management
 * 
 * Migrated from LogViewer.tsx lines 104-132
 * 
 * @returns Object containing state, actions, and refs
 */
export function useLogViewerState() {
  // ========== Scroll State ==========
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [maxLineWidth, setMaxLineWidth] = useState(0);

  // ========== UI State ==========
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; text: string; lineIndex?: number } | null>(null);
  const [commentPopover, setCommentPopover] = useState<{ x: number; y: number; lineIndex: number; comment: string } | null>(null);
  const [expandedJsonLine, setExpandedJsonLine] = useState<number | null>(null);
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({ fps: 60, visibleLines: 0, memory: 0 });

  // ========== Selection State ==========
  const [selection, setSelection] = useState<{
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);

  // ========== Data State ==========
  const [bridgedLines, setBridgedLines] = useState<Map<number, LogLine | string>>(new Map());
  const [jumpPulseIndex, setJumpPulseIndex] = useState<number | null>(null);

  // ========== Refs ==========
  const lastFetchRef = useRef<{ start: number; end: number }>({ start: -1, end: -1 });
  const scrollVelocityRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const lastScrollTimeRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  // ========== Derived State ==========
  const scrollState = useMemo<ScrollState>(() => ({
    scrollTop,
    scrollLeft,
    viewportHeight,
    viewportWidth,
    maxLineWidth,
  }), [scrollTop, scrollLeft, viewportHeight, viewportWidth, maxLineWidth]);

  const uiState = useMemo<UIState>(() => ({
    contextMenu,
    commentPopover,
    expandedJsonLine,
    showGoToLine,
    showPerformancePanel,
    performanceStats,
  }), [contextMenu, commentPopover, expandedJsonLine, showGoToLine, showPerformancePanel, performanceStats]);

  const selectionState = useMemo<SelectionState>(() => ({
    selection,
    isSelecting,
    hoveredLineIndex,
    highlightedWord,
  }), [selection, isSelecting, hoveredLineIndex, highlightedWord]);

  const dataState = useMemo<DataState>(() => ({
    bridgedLines,
    jumpPulseIndex,
  }), [bridgedLines, jumpPulseIndex]);

  // ========== Combined State ==========
  const state = useMemo<LogViewerState>(() => ({
    ...scrollState,
    ...uiState,
    ...selectionState,
    ...dataState,
  }), [scrollState, uiState, selectionState, dataState]);

  // ========== Actions ==========
  const updateBookmarks = useCallback((bookmarks: Record<number, string>) => {
    setBridgedLines(prev => {
      const next = new Map(prev);
      const bookmarkLines = new Set<number>(Object.keys(bookmarks).map(Number));
      
      for (const [lineIndex, line] of prev) {
        const idx = typeof lineIndex === 'number' ? lineIndex : Number(lineIndex);
        if (typeof line === 'object' && line !== null) {
          const logLine = line as LogLine;
          const hasBookmark = bookmarkLines.has(idx);
          if (hasBookmark || logLine.isMarked) {
            next.set(idx, {
              ...logLine,
              isMarked: hasBookmark,
              bookmarkComment: hasBookmark ? bookmarks[idx] : undefined,
            });
          }
        }
      }
      
      return next;
    });
  }, [setBridgedLines]);

  const actions = useMemo<LogViewerActions>(() => ({
    // Scroll actions
    setScrollTop,
    setScrollLeft,
    setViewportHeight,
    setViewportWidth,
    setMaxLineWidth,
    // UI actions
    setContextMenu,
    setCommentPopover,
    setExpandedJsonLine,
    setShowGoToLine,
    setShowPerformancePanel,
    setPerformanceStats,
    // Selection actions
    setSelection,
    setIsSelecting,
    setHoveredLineIndex,
    setHighlightedWord,
    // Data actions
    setBridgedLines,
    setJumpPulseIndex,
    updateBookmarks,
  }), [updateBookmarks]);

  // ========== Refs ==========
  const refs = useMemo<LogViewerRefs>(() => ({
    lastFetchRef,
    scrollVelocityRef,
    scrollDirectionRef,
    lastScrollTimeRef,
    lastScrollTopRef,
  }), []);

  return {
    state,
    actions,
    refs,
  };
}

export default useLogViewerState;