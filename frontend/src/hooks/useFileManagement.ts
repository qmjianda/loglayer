/**
 * useFileManagement - File state management hook
 * 
 * Manages file list, active file, loading states, and file operations.
 * Works with useBridge callbacks for backend integration.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { LogLayer, ProcessedCache } from '../types';
import { openFile, closeFile, selectFiles, selectFolder, hasNativeDialogs } from '../bridge_client';
import { basename, removeFromSet } from '../utils';

// File data interface - exported for use in other modules
export interface FileData {
    id: string;
    name: string;
    size: number;
    lineCount: number;
    rawCount: number;
    layers: LogLayer[];
    bookmarks: Record<number, string>;
    isBridged: true;
    path?: string;
    history?: {
        past: LogLayer[][];
        future: LogLayer[][];
    };
}

interface FileWithPath extends File {
    path?: string;
}

// Pane interface for split view support
// Can be either a leaf node (has files) or a container node (has split children)
export interface Pane {
    id: string;
    // Leaf node properties
    openFileIds: string[];
    activeFileId: string | null;
    // Container node properties (for nested splits)
    direction?: 'horizontal' | 'vertical';
    children?: Pane[];
    // Per-pane floating widget state
    findVisible?: boolean;
    goToLineVisible?: boolean;
    // Per-pane search state
    searchQuery?: string;
    searchConfig?: {
        regex: boolean;
        caseSensitive: boolean;
    };
    // Per-pane highlight and navigation state
    highlightedIndex?: number | null;
    scrollToIndex?: number | null;
    // Per-pane search match state
    searchMatchCount?: number;
    currentMatchRank?: number;  // 0-indexed, 用于导航
}

// In-memory cache for bridged file line counts
const bridgedCounts: Record<string, number> = {};

function getBridgedCount(fileId: string): number | undefined {
    return bridgedCounts[fileId];
}

// Helper to create a new pane with empty tabs
export function createPane(id?: string): Pane {
    return {
        id: id || `pane-${Date.now()}`,
        openFileIds: [],
        activeFileId: null,
        findVisible: false,
        goToLineVisible: false,
        searchQuery: '',
        searchConfig: { regex: false, caseSensitive: false },
        highlightedIndex: null,
        scrollToIndex: null,
        currentMatchRank: -1
    };
}

export function findPaneRecursive(panes: Pane[], id: string): Pane | undefined {
    for (const pane of panes) {
        if (pane.id === id) return pane;
        if (pane.children) {
            const found = findPaneRecursive(pane.children, id);
            if (found) return found;
        }
    }
    return undefined;
}

export function updatePaneInTree(
    panes: Pane[],
    targetId: string,
    updateFn: (pane: Pane) => Pane
): Pane[] {
    return panes.map(pane => {
        if (pane.id === targetId) {
            return updateFn(pane);
        }
        if (pane.children) {
            return {
                ...pane,
                children: updatePaneInTree(pane.children, targetId, updateFn)
            };
        }
        return pane;
    });
}

export function setBridgedCount(fileId: string, count: number): void {
    bridgedCounts[fileId] = count;
}

export interface UseFileManagementReturn {
    // File state
    files: FileData[];
    setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    activeFileId: string | null;
    activeFile: FileData | undefined;

    // Pane state
    panes: Pane[];
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
    activePaneId: string;
    setActivePaneId: (id: string) => void;

    // Loading state
    indexingFileIds: Set<string>;
    setIndexingFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    pendingCliFiles: number;
    setPendingCliFiles: React.Dispatch<React.SetStateAction<number>>;

    // Processed cache
    processedCache: Record<string, ProcessedCache>;
    setProcessedCache: React.Dispatch<React.SetStateAction<Record<string, ProcessedCache>>>;

    // Update trigger for LogViewer
    bridgedUpdateTrigger: number;
    triggerUpdate: () => void;

    // File operations
    setActiveFileId: (fileId: string | null) => void;
    handleFileActivate: (fileId: string) => void;
    handleFileRemove: (fileId: string) => void;
    addNewFiles: (files: { name: string; size?: number; path: string }[], autoActivateFirst?: boolean) => void;
    handleNativeFileSelect: () => Promise<void>;
    handleNativeFolderSelect: () => Promise<{ path: string; name: string } | null>;
    handleOpenFileByPath: (path: string, name: string) => void;

    // Refs for file inputs
    fileInputRef: React.RefObject<HTMLInputElement>;
    folderInputRef: React.RefObject<HTMLInputElement>;

    // File upload handlers
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleFolderUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;

    // Mark file as loading finished
    markFileLoaded: (fileId: string) => void;
}

export function useFileManagement(): UseFileManagementReturn {
    // File state
    const [files, setFiles] = useState<FileData[]>([]);

    // Pane state (for split view support)
    const [panes, setPanes] = useState<Pane[]>([createPane('pane-1')]);
    const [activePaneId, setActivePaneId] = useState<string>('pane-1');

    // Loading state - indexingFileIds controls both skeleton and indexing status
    const [indexingFileIds, setIndexingFileIds] = useState<Set<string>>(new Set());
    const [pendingCliFiles, setPendingCliFiles] = useState<number>(0);

    // Processed cache per file
    const [processedCache, setProcessedCache] = useState<Record<string, ProcessedCache>>({});

    // Update trigger for LogViewer
    const [bridgedUpdateTrigger, setBridgedUpdateTrigger] = useState(0);

    // File input refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Derive active file from panes (recursive search for nested panes)
    const activePane = findPaneRecursive(panes, activePaneId);
    const activeFileId = activePane?.activeFileId || null;
    const activeFile = useMemo(() => files.find(f => f.id === activeFileId), [files, activeFileId]);

    // Trigger update for LogViewer
    const triggerUpdate = useCallback(() => {
        setBridgedUpdateTrigger(v => v + 1);
    }, []);

    // Set active file for current pane (adds to openFileIds if needed)
    const setActiveFileId = useCallback((fileId: string | null) => {
        setPanes(prev => {
            const pane = activePaneId ? findPaneRecursive(prev, activePaneId) : null;
            
            if (!pane) {
                if (fileId === null || prev.length === 0) return prev;
                const flattened = prev.length > 0 ? (function flatten(items: Pane[]): Pane[] {
                    const result: Pane[] = [];
                    for (const item of items) {
                        if (item.children) {
                            result.push(...flatten(item.children));
                        } else {
                            result.push(item);
                        }
                    }
                    return result;
                })(prev) : [];
                const targetPane = flattened[0];
                if (targetPane) {
                    return updatePaneInTree(prev, targetPane.id, (p) => {
                        if (fileId === null) {
                            return { ...p, activeFileId: null };
                        }
                        const openFileIds = p.openFileIds.includes(fileId)
                            ? p.openFileIds
                            : [...p.openFileIds, fileId];
                        return { ...p, openFileIds, activeFileId: fileId };
                    });
                }
                const newPane = createPane(`pane-${Date.now()}`);
                return [{ ...newPane, openFileIds: [fileId], activeFileId: fileId }];
            }
            
            return updatePaneInTree(prev, activePaneId, (p) => {
                if (fileId === null) {
                    return { ...p, activeFileId: null };
                }
                
                const openFileIds = p.openFileIds.includes(fileId)
                    ? p.openFileIds
                    : [...p.openFileIds, fileId];
                
                return { ...p, openFileIds, activeFileId: fileId };
            });
        });
    }, [activePaneId]);

    // Activate file
    const handleFileActivate = useCallback((fileId: string) => {
        // Change UI state if needed
        if (activeFileId !== fileId) {
            setActiveFileId(fileId);
        }

        const file = files.find(f => f.id === fileId);
        if (!file?.path) return;

        // Check if backend has this file open
        const isLoaded = getBridgedCount(fileId) !== undefined;

        // Still trigger openFile if backend is not synchronized
        if (!isLoaded && !indexingFileIds.has(fileId)) {
            setIndexingFileIds(prev => new Set(prev).add(fileId));
            openFile(fileId, file.path);
        }
    }, [activeFileId, files, setActiveFileId, indexingFileIds]);

    // Remove file
    const handleFileRemove = useCallback((fileId: string) => {
        // 1. Notify backend to close file and release resources
        closeFile(fileId).catch(err => console.error(`[useFileManagement] Error closing file ${fileId}:`, err));

        // 2. Clean up local metadata
        setProcessedCache(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
        });

        setIndexingFileIds(prev => removeFromSet(prev, fileId));

        // 3. Update file list and active pane
        setFiles(prev => {
            const next = prev.filter(f => f.id !== fileId);
            if (activeFileId === fileId) {
                setActiveFileId(next.length > 0 ? next[0].id : null);
            }
            return next;
        });
    }, [activeFileId, setActiveFileId]);

    // Add new files (unified logic)
    const addNewFiles = useCallback((incomingFiles: { name: string; size?: number; path: string }[], autoActivateFirst = true) => {
        if (incomingFiles.length === 0) return;

        const newFiles: FileData[] = incomingFiles.map((f, i) => {
            const fileId = `bridged-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`;
            return {
                id: fileId,
                name: f.name,
                size: f.size || 0,
                lineCount: 0,
                rawCount: 0,
                layers: [],
                bookmarks: {},
                isBridged: true,
                path: f.path,
                history: { past: [], future: [] }
            };
        });

        setFiles(prev => [...prev, ...newFiles]);

        if (autoActivateFirst) {
            const first = newFiles[0];
            setActiveFileId(first.id);
            setIndexingFileIds(prev => new Set(prev).add(first.id));
            openFile(first.id, first.path!);
        }
    }, [setActiveFileId]);

    // Open file by path (checks for duplicates)
    const handleOpenFileByPath = useCallback((path: string, name: string) => {
        const existing = files.find(f => f.path === path);
        if (existing) {
            handleFileActivate(existing.id);
            return;
        }
        addNewFiles([{ name, path }], true);
    }, [files, handleFileActivate, addNewFiles]);

    // Native file selection
    const handleNativeFileSelect = useCallback(async () => {
        try {
            if (!window.fileBridge) return;
            const paths = await selectFiles();
            if (!paths || paths.length === 0) return;

            const validFiles = paths.map(path => ({
                name: basename(path),
                path: path
            }));

            addNewFiles(validFiles);
        } catch (e) {
            console.error('[useFileManagement] Native file select error:', e);
        }
    }, [addNewFiles]);

    // Native folder selection
    // 返回 null 时表示需要使用远程路径选择器（--no-ui 模式）
    const handleNativeFolderSelect = useCallback(async (): Promise<{ path: string; name: string } | null> => {
        try {
            if (!window.fileBridge) return null;

            // 检测是否支持原生对话框
            const hasDialogs = await hasNativeDialogs();
            if (!hasDialogs) {
                // 返回 null 触发远程路径选择器
                return null;
            }

            const folderPath = await selectFolder();
            if (!folderPath) return null;

            const folderName = basename(folderPath);
            return { path: folderPath, name: folderName };
        } catch (e) {
            console.error('[useFileManagement] Native folder select error:', e);
            return null;
        }
    }, []);

    // Handle file upload via input
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const rawFiles = event.target.files;
        if (!rawFiles || rawFiles.length === 0) return;
        const fileList = Array.from(rawFiles) as FileWithPath[];
        event.target.value = '';

        const validFiles = fileList
            .filter(f => f.path)
            .map(f => ({ name: f.name, size: f.size, path: f.path! }));

        addNewFiles(validFiles);
    }, [addNewFiles]);

    // Handle folder upload via input
    const handleFolderUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const rawFiles = event.target.files;
        if (!rawFiles || rawFiles.length === 0) return;
        const allFiles = Array.from(rawFiles) as FileWithPath[];
        const logFiles = allFiles.filter(file =>
            file.name.endsWith('.log') || file.name.endsWith('.txt') || file.name.endsWith('.json') || !file.name.includes('.')
        );

        const validFiles = logFiles
            .filter(f => f.path)
            .map(f => ({ name: f.name, size: f.size, path: f.path! }));

        addNewFiles(validFiles);
    }, [addNewFiles]);

    // Mark file as loaded (called from bridge callbacks)
    const markFileLoaded = useCallback((fileId: string) => {
        setIndexingFileIds(prev => removeFromSet(prev, fileId));
    }, []);

    return {
        files,
        setFiles,
        activeFileId,
        activeFile,
        panes,
        setPanes,
        activePaneId,
        setActivePaneId,
        indexingFileIds,
        setIndexingFileIds,
        pendingCliFiles,
        setPendingCliFiles,
        processedCache,
        setProcessedCache,
        bridgedUpdateTrigger,
        triggerUpdate,
        setActiveFileId,
        handleFileActivate,
        handleFileRemove,
        addNewFiles,
        handleNativeFileSelect,
        handleNativeFolderSelect,
        handleOpenFileByPath,
        fileInputRef,
        folderInputRef,
        handleFileUpload,
        handleFolderUpload,
        markFileLoaded
    };
}
