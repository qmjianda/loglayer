/**
 * usePaneManagement - Pane management hook for split-screen functionality
 * 
 * Handles creating, removing, and managing panes for multi-file viewing.
 * Supports drag-and-drop operations for intuitive pane creation.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Pane, FileData } from './useFileManagement';

export interface DragOverState {
    paneId: string;
    position: 'left' | 'right' | 'top' | 'bottom' | 'center';
}

export interface UsePaneManagementReturn {
    // Pane operations
    addPane: (fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => void;
    removePane: (paneId: string) => void;
    moveFileToPane: (fileId: string, targetPaneId: string) => void;
    splitPane: (sourcePaneId: string, fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => void;
    
    // Drag and drop state
    dragOverState: DragOverState | null;
    setDragOverState: React.Dispatch<React.SetStateAction<DragOverState | null>>;
    isDragging: boolean;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
    draggedFileId: string | null;
    setDraggedFileId: React.Dispatch<React.SetStateAction<string | null>>;
    
    // Drag handlers
    handleDragStart: (fileId: string) => void;
    handleDragEnd: () => void;
    handleDragOver: (e: React.DragEvent, paneId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'center') => void;
    handleDragLeave: () => void;
    handleDrop: (e: React.DragEvent, targetPaneId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'center') => void;
    
    // Layout
    layout: 'horizontal' | 'vertical' | 'grid';
    setLayout: React.Dispatch<React.SetStateAction<'horizontal' | 'vertical' | 'grid'>>;
}

export function usePaneManagement(
    panes: Pane[],
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>,
    activePaneId: string,
    setActivePaneId: (id: string) => void,
    files: FileData[],
    setActiveFileId: (fileId: string | null) => void
): UsePaneManagementReturn {
    const [dragOverState, setDragOverState] = useState<DragOverState | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
    const [layout, setLayout] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal');

    // Generate unique pane ID
    const generatePaneId = useCallback(() => {
        return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }, []);

    // Add new pane
    const addPane = useCallback((fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => {
        const newPaneId = generatePaneId();
        const newPane: Pane = { id: newPaneId, fileId: fileId || null };
        
        setPanes(prev => {
            const newPanes = [...prev];
            const activeIndex = newPanes.findIndex(p => p.id === activePaneId);
            
            if (activeIndex === -1) {
                // If no active pane, just add to end
                newPanes.push(newPane);
            } else if (position === 'right' || position === 'bottom') {
                // Add after active pane
                newPanes.splice(activeIndex + 1, 0, newPane);
            } else if (position === 'left' || position === 'top') {
                // Add before active pane
                newPanes.splice(activeIndex, 0, newPane);
            } else {
                // Default: add to end
                newPanes.push(newPane);
            }
            
            return newPanes;
        });
        
        // Activate the new pane
        setActivePaneId(newPaneId);
        
        // If fileId provided, set it for the new pane
        if (fileId) {
            setTimeout(() => {
                setPanes(prev => prev.map(p => p.id === newPaneId ? { ...p, fileId } : p));
            }, 0);
        }
    }, [generatePaneId, activePaneId, setActivePaneId, setPanes]);

    // Remove pane
    const removePane = useCallback((paneId: string) => {
        setPanes(prev => {
            if (prev.length <= 1) return prev; // Don't remove last pane
            
            const newPanes = prev.filter(p => p.id !== paneId);
            
            // If removed pane was active, activate another pane
            if (paneId === activePaneId) {
                const removedIndex = prev.findIndex(p => p.id === paneId);
                const newActiveIndex = Math.min(removedIndex, newPanes.length - 1);
                setTimeout(() => setActivePaneId(newPanes[newActiveIndex].id), 0);
            }
            
            return newPanes;
        });
    }, [activePaneId, setActivePaneId, setPanes]);

    // Move file to pane
    const moveFileToPane = useCallback((fileId: string, targetPaneId: string) => {
        setPanes(prev => prev.map(p => 
            p.id === targetPaneId ? { ...p, fileId } : p
        ));
        setActivePaneId(targetPaneId);
    }, [setPanes, setActivePaneId]);

    // Split pane (create new pane adjacent to source)
    const splitPane = useCallback((sourcePaneId: string, fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => {
        const newPaneId = generatePaneId();
        const sourcePane = panes.find(p => p.id === sourcePaneId);
        const fileToOpen = fileId || sourcePane?.fileId || null;
        
        const newPane: Pane = { id: newPaneId, fileId: fileToOpen };
        
        setPanes(prev => {
            const newPanes = [...prev];
            const sourceIndex = newPanes.findIndex(p => p.id === sourcePaneId);
            
            if (sourceIndex === -1) {
                newPanes.push(newPane);
            } else if (position === 'right' || position === 'bottom') {
                newPanes.splice(sourceIndex + 1, 0, newPane);
            } else if (position === 'left' || position === 'top') {
                newPanes.splice(sourceIndex, 0, newPane);
            } else {
                newPanes.push(newPane);
            }
            
            return newPanes;
        });
        
        setActivePaneId(newPaneId);
    }, [panes, generatePaneId, setActivePaneId, setPanes]);

    // Drag handlers
    const handleDragStart = useCallback((fileId: string) => {
        setIsDragging(true);
        setDraggedFileId(fileId);
    }, []);

    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
        setDraggedFileId(null);
        setDragOverState(null);
    }, []);

    const handleDragOver = useCallback((
        e: React.DragEvent,
        paneId: string,
        position: 'left' | 'right' | 'top' | 'bottom' | 'center'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverState({ paneId, position });
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverState(null);
    }, []);

    const handleDrop = useCallback((
        e: React.DragEvent,
        targetPaneId: string,
        position: 'left' | 'right' | 'top' | 'bottom' | 'center'
    ) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!draggedFileId) {
            handleDragEnd();
            return;
        }

        // If dropping on center, replace the file in target pane
        if (position === 'center') {
            moveFileToPane(draggedFileId, targetPaneId);
        } else {
            // Otherwise, split the pane and place file in new pane
            splitPane(targetPaneId, draggedFileId, position);
        }
        
        handleDragEnd();
    }, [draggedFileId, moveFileToPane, splitPane, handleDragEnd]);

    return {
        addPane,
        removePane,
        moveFileToPane,
        splitPane,
        dragOverState,
        setDragOverState,
        isDragging,
        setIsDragging,
        draggedFileId,
        setDraggedFileId,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        layout,
        setLayout
    };
}
