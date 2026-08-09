/**
 * useUIState - UI interaction state hook
 *
 * Manages UI state like sidebar width, active views, find/goto visibility,
 * scroll position, and keyboard shortcuts.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useSearchStore } from '../store/searchStore';

export type ActiveView = 'main' | 'search' | 'ai' | 'help';

export interface UseUIStateProps {
  undo: () => void;
  redo: () => void;
  setSearchQuery: (query: string) => void;
  searchQuery: string;
  canvasSelectedText?: string;
  // 书签导航回调
  onNavigateToNextBookmark?: () => void;
  onNavigateToPrevBookmark?: () => void;
  // 快捷键回调
  onToggleSidebar?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onShowSearchHistory?: () => void;
  /** Esc 两段式第二段：查找条已收起且搜索词非空时清空搜索（VSCode 语义） */
  onClearSearch?: () => void;
}

export interface UseUIStateReturn {
  // View state
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  // Inspector (右侧操作台)
  inspectorWidth: number;
  setInspectorWidth: Dispatch<SetStateAction<number>>;

  // Find/GoTo widgets
  isGoToLineVisible: boolean;
  setIsGoToLineVisible: (visible: boolean) => void;

  // Scroll/highlight
  scrollToIndex: number | null;
  setScrollToIndex: (index: number | null) => void;
  highlightedIndex: number | null;
  setHighlightedIndex: (index: number | null) => void;

  // Processing status
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  loadingProgress: number;
  setLoadingProgress: (progress: number) => void;
  operationStatus: { op: string; progress: number; error?: string } | null;
  setOperationStatus: (status: { op: string; progress: number; error?: string } | null) => void;

  // Workspace
  workspaceRoot: { path: string; name: string } | null;
  setWorkspaceRoot: (root: { path: string; name: string } | null) => void;

  // Jump to line helper
  handleJumpToLine: (index: number, totalLines: number) => void;

  // Log viewer interaction handler
  handleLogViewerInteraction: () => void;

  // File watch
  isWatching: boolean;
  setIsWatching: (watching: boolean) => void;
  hasNewContent: boolean;
  setHasNewContent: (has: boolean) => void;
}

export function useUIState({
  undo,
  redo,
  setSearchQuery,
  searchQuery,
  canvasSelectedText,
  onNavigateToNextBookmark,
  onNavigateToPrevBookmark,
  onToggleSidebar,
  onOpenFile,
  onOpenFolder,
  onShowSearchHistory,
  onClearSearch,
}: UseUIStateProps): UseUIStateReturn {
  // View state
  const [activeView, setActiveView] = useState<ActiveView>('main');

  // Sidebar
  const [sidebarWidth, setSidebarWidth] = useState(288);

  // Inspector (右侧操作台)
  const [inspectorWidth, setInspectorWidth] = useState(300);

  // GoTo widget（find widget 可见性由 searchStore per-tab 管理）
  const [isGoToLineVisible, setIsGoToLineVisible] = useState(false);

  // Scroll/highlight
  const [scrollToIndex, setScrollToIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  // Processing status
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [operationStatus, setOperationStatus] = useState<{
    op: string;
    progress: number;
    error?: string;
  } | null>(null);

  // Workspace
  const [workspaceRoot, setWorkspaceRoot] = useState<{ path: string; name: string } | null>(null);

  // File watch
  const [isWatching, setIsWatching] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      const isF = e.key.toLowerCase() === 'f';
      const isG = e.key.toLowerCase() === 'g';
      const isB = e.key.toLowerCase() === 'b';
      const isO = e.key.toLowerCase() === 'o';
      const isH = e.key.toLowerCase() === 'h';
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Ctrl+B: 切换侧边栏
      if (isCmdOrCtrl && isB && !isInput) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // Ctrl+O: 打开文件
      if (isCmdOrCtrl && isO && !isShift && !isInput) {
        e.preventDefault();
        onOpenFile?.();
        return;
      }

      // Ctrl+Shift+O: 打开文件夹
      if (isCmdOrCtrl && isO && isShift && !isInput) {
        e.preventDefault();
        onOpenFolder?.();
        return;
      }

      // Ctrl+H: 搜索历史
      if (isCmdOrCtrl && isH && !isInput) {
        e.preventDefault();
        onShowSearchHistory?.();
        return;
      }

      if (isCmdOrCtrl && isZ) {
        e.preventDefault();
        if (isShift) redo();
        else undo();
      } else if (isCmdOrCtrl && isY) {
        e.preventDefault();
        redo();
      } else if (isCmdOrCtrl && isF) {
        e.preventDefault();
        const selText = canvasSelectedText || window.getSelection()?.toString() || '';
        if (selText) {
          const firstLine = selText.split(/\r?\n/)[0].trim();
          if (firstLine) {
            setSearchQuery(firstLine);
          }
        }
        // 打开激活面板的 find widget 并触发 focus+select（无激活面板 no-op）
        const activePanelId = useSearchStore.getState().activePanelId;
        if (activePanelId) {
          useSearchStore.getState().requestFocus(activePanelId);
        }
      } else if (isCmdOrCtrl && isG) {
        e.preventDefault();
        setIsGoToLineVisible(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (isShift) {
          onNavigateToPrevBookmark?.();
        } else {
          onNavigateToNextBookmark?.();
        }
      } else if (e.key === 'Escape') {
        // 两段式：作用于激活面板的 find widget
        const activePanelId = useSearchStore.getState().activePanelId;
        const activeTab = activePanelId ? useSearchStore.getState().tabs[activePanelId] : undefined;
        if (activeTab?.isFindVisible) {
          // 第一段：收起查找条，保留搜索词与高亮
          useSearchStore.getState().setFindVisible(activePanelId, false);
        } else if (searchQuery && onClearSearch) {
          // 第二段：查找条已收起且仍有搜索词时清空
          onClearSearch();
        }
        if (isGoToLineVisible) setIsGoToLineVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    isGoToLineVisible,
    setSearchQuery,
    searchQuery,
    canvasSelectedText,
    onNavigateToNextBookmark,
    onNavigateToPrevBookmark,
    onToggleSidebar,
    onOpenFile,
    onOpenFolder,
    onShowSearchHistory,
    onClearSearch,
  ]);

  // Jump to line
  const scrollResetTimerRef = useRef<number | null>(null);
  const handleJumpToLine = useCallback((index: number, totalLines: number) => {
    if (totalLines === 0) return;

    const boundedIndex = Math.max(0, Math.min(index, totalLines - 1));

    setScrollToIndex(boundedIndex);
    setHighlightedIndex(boundedIndex);

    // 先清空上一跳的清空定时器，防止快速连续跳转时旧定时器清除新滚动信号
    if (scrollResetTimerRef.current !== null) {
      clearTimeout(scrollResetTimerRef.current);
    }
    scrollResetTimerRef.current = window.setTimeout(() => {
      setScrollToIndex(null);
    }, 150);
  }, []);

  // Handle log viewer interaction (clears highlight when user interacts)
  const handleLogViewerInteraction = useCallback(() => {
    if (highlightedIndex !== null) {
      setHighlightedIndex(null);
    }
    const activePanelId = useSearchStore.getState().activePanelId;
    const findVisible = activePanelId
      ? useSearchStore.getState().tabs[activePanelId]?.isFindVisible
      : false;
    if (!findVisible && activeView !== 'search' && searchQuery) {
      setSearchQuery('');
    }
  }, [highlightedIndex, activeView, searchQuery, setSearchQuery]);

  return {
    activeView,
    setActiveView,
    sidebarWidth,
    setSidebarWidth,
    inspectorWidth,
    setInspectorWidth,
    isGoToLineVisible,
    setIsGoToLineVisible,
    scrollToIndex,
    setScrollToIndex,
    highlightedIndex,
    setHighlightedIndex,
    isProcessing,
    setIsProcessing,
    loadingProgress,
    setLoadingProgress,
    operationStatus,
    setOperationStatus,
    workspaceRoot,
    setWorkspaceRoot,
    handleJumpToLine,
    handleLogViewerInteraction,
    isWatching,
    setIsWatching,
    hasNewContent,
    setHasNewContent,
  };
}
