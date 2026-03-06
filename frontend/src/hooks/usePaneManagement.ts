import React, { useCallback } from 'react';
import { Pane, FileData } from './useFileManagement';

export const MAX_PANES = 4;

export interface UsePaneManagementReturn {
    splitPane: (sourcePaneId: string, fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => void;
    removePane: (paneId: string) => void;
}

export function usePaneManagement(
    panes: Pane[],
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>,
    activePaneId: string,
    setActivePaneId: (id: string) => void,
    files: FileData[],
    setActiveFileId: (fileId: string | null) => void
): UsePaneManagementReturn {
    const generatePaneId = useCallback(() => {
        return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }, []);

    const removePane = useCallback((paneId: string) => {
        setPanes(prev => {
            if (prev.length <= 1) return prev;
            const newPanes = prev.filter(p => p.id !== paneId);
            if (paneId === activePaneId) {
                const removedIndex = prev.findIndex(p => p.id === paneId);
                const newActiveIndex = Math.min(removedIndex, newPanes.length - 1);
                setTimeout(() => setActivePaneId(newPanes[newActiveIndex].id), 0);
            }
            return newPanes;
        });
    }, [activePaneId, setActivePaneId, setPanes]);

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

    return {
        splitPane,
        removePane
    };
}
