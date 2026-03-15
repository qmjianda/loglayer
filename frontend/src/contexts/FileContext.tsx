/**
 * FileContext - Global file state management
 * 
 * Provides centralized file state for the application using React Context.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { LogLayer } from '../types';

export interface FileData {
    id: string;
    name: string;
    size: number;
    lineCount: number;
    rawCount: number;
    layers: LogLayer[];
    isBridged: true;
    path?: string;
    history?: {
        past: LogLayer[][];
        future: LogLayer[][];
    };
}

export interface Pane {
    id: string;
    fileId: string | null;
}

export interface ProcessedCache {
    layerStats: Record<string, { count: number; distribution: number[] }>;
    searchMatchCount: number;
}

interface FileContextValue {
    // File state
    files: FileData[];
    setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
    activeFileId: string | null;
    activeFile: FileData | undefined;
    
    // Pane state
    panes: Pane[];
    activePaneId: string;
    setActivePaneId: (id: string) => void;
    
    // Loading state
    indexingFileIds: Set<string>;
    pendingCliFiles: number;
    
    // Processed cache
    processedCache: Record<string, ProcessedCache>;
    setProcessedCache: React.Dispatch<React.SetStateAction<Record<string, ProcessedCache>>>;
    
    // Update trigger
    bridgedUpdateTrigger: number;
    triggerUpdate: () => void;
    
    // File operations
    setActiveFileId: (fileId: string | null) => void;
    handleFileActivate: (fileId: string) => void;
    handleFileRemove: (fileId: string) => void;
    addNewFiles: (files: { name: string; size?: number; path: string }[], autoActivateFirst?: boolean) => void;
    markFileLoaded: (fileId: string) => void;
    
    // Utility
    getFileById: (id: string) => FileData | undefined;
}

const FileContext = createContext<FileContextValue | null>(null);

export function FileProvider({ children }: { children: React.ReactNode }) {
    const [files, setFiles] = useState<FileData[]>([]);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [panes, setPanes] = useState<Pane[]>([{ id: 'main', fileId: null }]);
    const [activePaneId, setActivePaneId] = useState('main');
    const [indexingFileIds, setIndexingFileIds] = useState<Set<string>>(new Set());
    const [pendingCliFiles, setPendingCliFiles] = useState(0);
    const [processedCache, setProcessedCache] = useState<Record<string, ProcessedCache>>({});
    const [bridgedUpdateTrigger, setBridgedUpdateTrigger] = useState(0);
    
    const activeFile = useMemo(() => {
        return files.find(f => f.id === activeFileId);
    }, [files, activeFileId]);
    
    const triggerUpdate = useCallback(() => {
        setBridgedUpdateTrigger(t => t + 1);
    }, []);
    
    const handleFileActivate = useCallback((fileId: string) => {
        setActiveFileId(fileId);
        setPanes(prev => prev.map(p => 
            p.id === activePaneId ? { ...p, fileId } : p
        ));
    }, [activePaneId]);
    
    const handleFileRemove = useCallback((fileId: string) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        if (activeFileId === fileId) {
            const remaining = files.filter(f => f.id !== fileId);
            setActiveFileId(remaining.length > 0 ? remaining[0].id : null);
        }
    }, [activeFileId, files]);
    
    const addNewFiles = useCallback((newFiles: { name: string; size?: number; path: string }[], autoActivateFirst = true) => {
        const fileDataList: FileData[] = newFiles.map((f, i) => ({
            id: `file-${Date.now()}-${i}`,
            name: f.name,
            size: f.size || 0,
            lineCount: 0,
            rawCount: 0,
            layers: [],
            isBridged: true as const,
            path: f.path,
        }));
        
        setFiles(prev => [...prev, ...fileDataList]);
        
        if (autoActivateFirst && fileDataList.length > 0 && !activeFileId) {
            setActiveFileId(fileDataList[0].id);
        }
    }, [activeFileId]);
    
    const markFileLoaded = useCallback((fileId: string) => {
        setIndexingFileIds(prev => {
            const next = new Set(prev);
            next.delete(fileId);
            return next;
        });
    }, []);
    
    const getFileById = useCallback((id: string) => {
        return files.find(f => f.id === id);
    }, [files]);
    
    const value = useMemo<FileContextValue>(() => ({
        files,
        setFiles,
        activeFileId,
        activeFile,
        panes,
        activePaneId,
        setActivePaneId,
        indexingFileIds,
        pendingCliFiles,
        processedCache,
        setProcessedCache,
        bridgedUpdateTrigger,
        triggerUpdate,
        setActiveFileId,
        handleFileActivate,
        handleFileRemove,
        addNewFiles,
        markFileLoaded,
        getFileById,
    }), [
        files, activeFileId, activeFile, panes, activePaneId,
        indexingFileIds, pendingCliFiles,
        processedCache, bridgedUpdateTrigger, triggerUpdate,
        handleFileActivate, handleFileRemove, addNewFiles,
        markFileLoaded, getFileById
    ]);
    
    return (
        <FileContext.Provider value={value}>
            {children}
        </FileContext.Provider>
    );
}

export function useFileContext(): FileContextValue {
    const context = useContext(FileContext);
    if (!context) {
        throw new Error('useFileContext must be used within a FileProvider');
    }
    return context;
}

export { FileContext };