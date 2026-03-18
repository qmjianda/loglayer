/**
 * useUIState - UI interaction state hook
 * 
 * Manages UI state like sidebar width, active views, find/goto visibility,
 * scroll position, and keyboard shortcuts.
 */

import { useState, useCallback, useEffect } from 'react';

export type ActiveView = 'main' | 'help';

export interface UseUIStateProps {
    undo: () => void;
    redo: () => void;
    setSearchQuery: (query: string) => void;
    searchQuery: string;
    canvasSelectedText?: string;
    onNavigateToNextBookmark?: () => void;
    onNavigateToPrevBookmark?: () => void;
    onToggleSidebar?: () => void;
    onOpenFile?: () => void;
    onOpenFolder?: () => void;
    onShowSearchHistory?: () => void;
    onToggleFind?: (visible: boolean) => void;
    onToggleGoToLine?: (visible: boolean) => void;
    isFindVisible?: boolean;
    isGoToLineVisible?: boolean;
}

export interface UseUIStateReturn {
    activeView: ActiveView;
    setActiveView: (view: ActiveView) => void;

    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;

    scrollToIndex: number | null;
    setScrollToIndex: (index: number | null) => void;
    highlightedIndex: number | null;
    setHighlightedIndex: (index: number | null) => void;

    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;
    loadingProgress: number;
    setLoadingProgress: (progress: number) => void;
    operationStatus: { op: string; progress: number; error?: string } | null;
    setOperationStatus: (status: { op: string; progress: number; error?: string } | null) => void;

    workspaceRoot: { path: string; name: string } | null;
    setWorkspaceRoot: (root: { path: string; name: string } | null) => void;

    handleJumpToLine: (index: number, totalLines: number) => void;

    handleLogViewerInteraction: () => void;

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
    onToggleFind,
    onToggleGoToLine,
    isFindVisible = false,
    isGoToLineVisible = false
}: UseUIStateProps): UseUIStateReturn {
    const [activeView, setActiveView] = useState<ActiveView>('main');

    const [sidebarWidth, setSidebarWidth] = useState(288);

    const [scrollToIndex, setScrollToIndex] = useState<number | null>(null);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [operationStatus, setOperationStatus] = useState<{ op: string; progress: number; error?: string } | null>(null);

    const [workspaceRoot, setWorkspaceRoot] = useState<{ path: string; name: string } | null>(null);

    const [isWatching, setIsWatching] = useState(false);
    const [hasNewContent, setHasNewContent] = useState(false);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            
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
                onToggleFind?.(true);
            } else if (isCmdOrCtrl && isG) {
                e.preventDefault();
                onToggleGoToLine?.(true);
            } else if (e.key === 'F2') {
                e.preventDefault();
                if (isShift) {
                    onNavigateToPrevBookmark?.();
                } else {
                    onNavigateToNextBookmark?.();
                }
            } else if (e.key === 'Escape') {
                if (isFindVisible) onToggleFind?.(false);
                if (isGoToLineVisible) onToggleGoToLine?.(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, isFindVisible, isGoToLineVisible, setSearchQuery, canvasSelectedText, onNavigateToNextBookmark, onNavigateToPrevBookmark, onToggleSidebar, onOpenFile, onOpenFolder, onShowSearchHistory, onToggleFind, onToggleGoToLine]);

    // Jump to line
    const handleJumpToLine = useCallback((index: number, totalLines: number) => {
        if (totalLines === 0) return;

        const boundedIndex = Math.max(0, Math.min(index, totalLines - 1));

        setScrollToIndex(boundedIndex);
        setHighlightedIndex(boundedIndex);

        // Clear scroll signal after delay
        setTimeout(() => {
            setScrollToIndex(null);
        }, 150);
    }, []);

    // Handle log viewer interaction (clears highlight when user interacts)
    const handleLogViewerInteraction = useCallback(() => {
        if (highlightedIndex !== null) {
            setHighlightedIndex(null);
        }
        if (!isFindVisible && searchQuery) {
            setSearchQuery('');
        }
    }, [highlightedIndex, isFindVisible, searchQuery, setSearchQuery]);

return {
        activeView,
        setActiveView,
        sidebarWidth,
        setSidebarWidth,
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
        setHasNewContent
    };
}
