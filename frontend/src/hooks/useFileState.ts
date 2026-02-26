/**
 * useFileState - File state management hook
 * 
 * Manages file loading states, watching, and progress tracking.
 * Merged from useFileWatch and useLoadingState.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../utils';

export interface FileInfo {
    path: string;
    size: number;
    mtime: number;
    lineCount: number;
}

export interface LoadingState {
    isLoading: boolean;
    progress?: number;
    message?: string;
    error?: string;
}

export interface UseFileStateOptions {
    onNewContent?: (fileInfo: FileInfo) => void;
    onNewLines?: (newLineCount: number, totalLines: number) => void;
}

export interface UseFileStateReturn {
    // File watching
    isWatching: boolean;
    startWatching: (fileId: string) => void;
    stopWatching: () => void;
    hasNewContent: boolean;
    newContentCount: number;
    clearNewContent: () => void;

    // Loading states
    loadingStates: Map<string, LoadingState>;
    isAnyLoading: boolean;
    startLoading: (key: string, message?: string) => void;
    updateProgress: (key: string, progress: number) => void;
    stopLoading: (key: string) => void;
    setError: (key: string, error: string) => void;
    clearError: (key: string) => void;
    getLoadingState: (key: string) => LoadingState | undefined;
}

export function useFileState(options: UseFileStateOptions = {}): UseFileStateReturn {
    // === File Watch State ===
    const [isWatching, setIsWatching] = useState(false);
    const [hasNewContent, setHasNewContent] = useState(false);
    const [newContentCount, setNewContentCount] = useState(0);
    const fileIdRef = useRef<string | null>(null);
    const lastMtimeRef = useRef<number>(0);
    const lastLineCountRef = useRef<number>(0);
    const intervalRef = useRef<number | null>(null);

    // === Loading State ===
    const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState>>(new Map());

    // === File Watch Methods ===
    const checkForChanges = useCallback(async () => {
        const fileId = fileIdRef.current;
        if (!fileId) return;

        try {
            const backendUrl = getBackendUrl();
            const res = await fetch(`${backendUrl}/api/file_info?file_id=${fileId}`);
            const data = await res.json();
            
            if (data.error) return;

            const mtime = data.mtime;
            const lineCount = data.lineCount;

            if (mtime !== lastMtimeRef.current || lineCount !== lastLineCountRef.current) {
                const newLines = Math.max(0, lineCount - lastLineCountRef.current);
                
                if (newLines > 0 || mtime !== lastMtimeRef.current) {
                    setHasNewContent(true);
                    setNewContentCount(prev => prev + newLines);
                    lastMtimeRef.current = mtime;
                    lastLineCountRef.current = lineCount;
                    
                    options.onNewContent?.(data);
                    
                    if (newLines > 0) {
                        options.onNewLines?.(newLines, lineCount);
                    }
                }
            }
        } catch (err) {
            console.error('[FileState] Error checking for changes:', err);
        }
    }, [options.onNewContent, options.onNewLines]);

    const startWatching = useCallback((fileId: string) => {
        fileIdRef.current = fileId;
        setIsWatching(true);
        setHasNewContent(false);
        setNewContentCount(0);
        
        checkForChanges();
        intervalRef.current = window.setInterval(checkForChanges, 2000);
    }, [checkForChanges]);

    const stopWatching = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        fileIdRef.current = null;
        setIsWatching(false);
        setHasNewContent(false);
        setNewContentCount(0);
    }, []);

    const clearNewContent = useCallback(() => {
        setHasNewContent(false);
        setNewContentCount(0);
    }, []);

    // === Loading State Methods ===
    const startLoading = useCallback((key: string, message?: string) => {
        setLoadingStates(prev => {
            const next = new Map(prev);
            next.set(key, { isLoading: true, message });
            return next;
        });
    }, []);

    const updateProgress = useCallback((key: string, progress: number) => {
        setLoadingStates(prev => {
            const current = prev.get(key);
            if (!current) return prev;
            const next = new Map(prev);
            next.set(key, { ...current, progress });
            return next;
        });
    }, []);

    const stopLoading = useCallback((key: string) => {
        setLoadingStates(prev => {
            const current = prev.get(key);
            if (!current) return prev;
            const next = new Map(prev);
            next.set(key, { ...current, isLoading: false, progress: 100 });
            return next;
        });
    }, []);

    const setError = useCallback((key: string, error: string) => {
        setLoadingStates(prev => {
            const next = new Map(prev);
            next.set(key, { isLoading: false, error });
            return next;
        });
    }, []);

    const clearError = useCallback((key: string) => {
        setLoadingStates(prev => {
            const current = prev.get(key);
            if (!current) return prev;
            const next = new Map(prev);
            next.set(key, { ...current, error: undefined });
            return next;
        });
    }, []);

    const getLoadingState = useCallback((key: string) => {
        return loadingStates.get(key);
    }, [loadingStates]);

    const isAnyLoading = Array.from(loadingStates.values()).some(s => s.isLoading);

    // Cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        // File watching
        isWatching,
        startWatching,
        stopWatching,
        hasNewContent,
        newContentCount,
        clearNewContent,

        // Loading states
        loadingStates,
        isAnyLoading,
        startLoading,
        updateProgress,
        stopLoading,
        setError,
        clearError,
        getLoadingState,
    };
}
