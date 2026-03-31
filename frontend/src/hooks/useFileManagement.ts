/**
 * useFileManagement - File state management hook
 * 
 * Manages file list, active file, loading states, and file operations.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { LogLayer, ProcessedCache } from '../types';
import { openFile, closeFile, selectFiles, selectFolder, hasNativeDialogs } from '../bridge_client';
import { basename, removeFromSet } from '../utils';

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
    highlightedIndex?: number | null;
}

interface FileWithPath extends File {
    path?: string;
}

const bridgedCounts: Record<string, number> = {};

export function getBridgedCount(fileId: string): number | undefined {
    return bridgedCounts[fileId];
}

export function setBridgedCount(fileId: string, count: number): void {
    bridgedCounts[fileId] = count;
}

export interface UseFileManagementReturn {
    files: FileData[];
    setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    activeFileId: string | null;
    activeFile: FileData | undefined;

    indexingFileIds: Set<string>;
    setIndexingFileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    pendingCliFiles: number;
    setPendingCliFiles: React.Dispatch<React.SetStateAction<number>>;

    processedCache: Record<string, ProcessedCache>;
    setProcessedCache: React.Dispatch<React.SetStateAction<Record<string, ProcessedCache>>>;

    bridgedUpdateTrigger: number;
    triggerUpdate: () => void;

    setActiveFileId: (fileId: string | null) => void;
    handleFileActivate: (fileId: string) => void;
    handleFileRemove: (fileId: string) => void;
    addNewFiles: (files: { name: string; size?: number; path: string }[], autoActivateFirst?: boolean) => void;
    handleNativeFileSelect: () => Promise<void>;
    handleNativeFolderSelect: () => Promise<{ path: string; name: string } | null>;
    handleOpenFileByPath: (path: string, name: string) => void;

    fileInputRef: React.RefObject<HTMLInputElement>;
    folderInputRef: React.RefObject<HTMLInputElement>;

    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleFolderUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;

    markFileLoaded: (fileId: string) => void;
}

export function useFileManagement(): UseFileManagementReturn {
    const [files, setFiles] = useState<FileData[]>([]);

    const [indexingFileIds, setIndexingFileIds] = useState<Set<string>>(new Set());
    const [pendingCliFiles, setPendingCliFiles] = useState<number>(0);

    const [processedCache, setProcessedCache] = useState<Record<string, ProcessedCache>>({});

    const [bridgedUpdateTrigger, setBridgedUpdateTrigger] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const triggerUpdate = useCallback(() => {
        setBridgedUpdateTrigger(v => v + 1);
    }, []);

    const markFileLoaded = useCallback((fileId: string) => {
        setIndexingFileIds(prev => removeFromSet(prev, fileId));
    }, []);

    const setActiveFileId = useCallback((_fileId: string | null) => {
        // This is now handled by usePaneManagement
    }, []);

    const handleFileActivate = useCallback((fileId: string) => {
        const file = files.find(f => f.id === fileId);
        if (!file?.path) return;

        const isLoaded = getBridgedCount(fileId) !== undefined;

        if (!isLoaded && !indexingFileIds.has(fileId)) {
            setIndexingFileIds(prev => new Set(prev).add(fileId));
            openFile(fileId, file.path);
        }
    }, [files, indexingFileIds]);

    const handleFileRemove = useCallback((fileId: string) => {
        closeFile(fileId).catch(err => console.error(`[useFileManagement] Error closing file ${fileId}:`, err));

        setProcessedCache(prev => {
            const next = { ...prev };
            delete next[fileId];
            return next;
        });

        setIndexingFileIds(prev => removeFromSet(prev, fileId));

        setFiles(prev => {
            const next = prev.filter(f => f.id !== fileId);
            return next;
        });
    }, []);

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
            setIndexingFileIds(prev => new Set(prev).add(first.id));
            openFile(first.id, first.path!);
        }
    }, []);

    const handleOpenFileByPath = useCallback((path: string, name: string) => {
        const existing = files.find(f => f.path === path);
        if (existing) {
            handleFileActivate(existing.id);
            return;
        }
        addNewFiles([{ name, path }], true);
    }, [files, handleFileActivate, addNewFiles]);

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

    const handleNativeFolderSelect = useCallback(async (): Promise<{ path: string; name: string } | null> => {
        try {
            if (!window.fileBridge) return null;

            const hasDialogs = await hasNativeDialogs();
            if (!hasDialogs) {
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

    return {
        files,
        setFiles,
        activeFileId: null,
        activeFile: undefined,

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
