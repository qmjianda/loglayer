import { useState, useCallback, useEffect } from 'react';
import { useShortcut } from '../shortcuts';

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

    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [operationStatus, setOperationStatus] = useState<{ op: string; progress: number; error?: string } | null>(null);

    const [workspaceRoot, setWorkspaceRoot] = useState<{ path: string; name: string } | null>(null);

    const [isWatching, setIsWatching] = useState(false);
    const [hasNewContent, setHasNewContent] = useState(false);

    useShortcut('toggleSidebar', useCallback(() => {
        onToggleSidebar?.();
    }, [onToggleSidebar]));

    useShortcut('openFile', useCallback(() => {
        onOpenFile?.();
    }, [onOpenFile]));

    useShortcut('openFolder', useCallback(() => {
        onOpenFolder?.();
    }, [onOpenFolder]));

    useShortcut('searchHistory', useCallback(() => {
        onShowSearchHistory?.();
    }, [onShowSearchHistory]));

    useShortcut('undo', useCallback(() => {
        undo();
    }, [undo]));

    useShortcut('redo', useCallback(() => {
        redo();
    }, [redo]));

    useShortcut('find', useCallback(() => {
        const selText = canvasSelectedText || window.getSelection()?.toString() || '';
        if (selText) {
            const firstLine = selText.split(/\r?\n/)[0].trim();
            if (firstLine) {
                setSearchQuery(firstLine);
            }
        }
        onToggleFind?.(true);
    }, [setSearchQuery, canvasSelectedText, onToggleFind]));

    useShortcut('gotoLine', useCallback(() => {
        onToggleGoToLine?.(true);
    }, [onToggleGoToLine]));

    useShortcut('nextBookmark', useCallback(() => {
        onNavigateToNextBookmark?.();
    }, [onNavigateToNextBookmark]));

    useShortcut('prevBookmark', useCallback(() => {
        onNavigateToPrevBookmark?.();
    }, [onNavigateToPrevBookmark]));

    useShortcut('escape', useCallback(() => {
        if (isFindVisible) onToggleFind?.(false);
        if (isGoToLineVisible) onToggleGoToLine?.(false);
    }, [isFindVisible, isGoToLineVisible, onToggleFind, onToggleGoToLine]));

    const handleJumpToLine = useCallback((index: number, totalLines: number) => {
        if (totalLines === 0) return;

        const boundedIndex = Math.max(0, Math.min(index, totalLines - 1));

        setScrollToIndex(boundedIndex);

        setTimeout(() => {
            setScrollToIndex(null);
        }, 150);
    }, []);

    const handleLogViewerInteraction = useCallback(() => {
        if (!isFindVisible && searchQuery) {
            setSearchQuery('');
        }
    }, [isFindVisible, searchQuery, setSearchQuery]);

    return {
        activeView,
        setActiveView,
        sidebarWidth,
        setSidebarWidth,
        scrollToIndex,
        setScrollToIndex,
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