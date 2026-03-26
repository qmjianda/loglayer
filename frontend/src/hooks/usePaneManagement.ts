import React, { useCallback } from 'react';
import { Pane, FileData } from './useFileManagement';

export const MAX_PANES = 99;

export interface UsePaneManagementReturn {
    splitPane: (sourcePaneId: string, fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => void;
    removePane: (paneId: string) => void;
}

function findPane(panes: Pane[], id: string): Pane | undefined {
    for (const pane of panes) {
        if (pane.id === id) return pane;
        if (pane.children) {
            const found = findPane(pane.children, id);
            if (found) return found;
        }
    }
    return undefined;
}

function flattenPanes(panes: Pane[]): Pane[] {
    const result: Pane[] = [];
    function flatten(items: Pane[]) {
        for (const item of items) {
            if (item.children) {
                flatten(item.children);
            } else {
                result.push(item);
            }
        }
    }
    flatten(panes);
    return result;
}

function removePaneFromTree(panes: Pane[], targetId: string): Pane[] {
    const result: Pane[] = [];
    for (const pane of panes) {
        if (pane.id === targetId) continue;
        if (pane.children) {
            const newChildren = removePaneFromTree(pane.children, targetId);
            if (newChildren.length === 0) {
                continue;
            } else if (newChildren.length === 1 && !newChildren[0].children) {
                result.push(newChildren[0]);
            } else {
                result.push({ ...pane, children: newChildren });
            }
        } else {
            result.push({
                ...pane,
                findVisible: false,
                goToLineVisible: false,
                searchQuery: '',
                searchConfig: { regex: false, caseSensitive: false },
                highlightedIndex: null,
                scrollToIndex: null,
                searchMatchCount: 0,
                currentMatchRank: -1
            });
        }
    }
    return result;
}

function splitPaneInTree(
    panes: Pane[], 
    sourcePaneId: string, 
    newPane: Pane, 
    position: string | undefined,
    isHorizontal: boolean
): Pane[] {
    const newDirection = isHorizontal ? 'horizontal' : 'vertical';
    
    function splitInTree(items: Pane[], parentDirection?: string): Pane[] {
        const result: Pane[] = [];
        let processed = false;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.id === sourcePaneId) {
                processed = true;
                const sourcePane = item;
                
                if (parentDirection && parentDirection === newDirection) {
                    if (position === 'right' || position === 'bottom') {
                        result.push(sourcePane);
                        result.push(newPane);
                    } else {
                        result.push(newPane);
                        result.push(sourcePane);
                    }
                } else {
                    const children = position === 'right' || position === 'bottom'
                        ? [sourcePane, newPane]
                        : [newPane, sourcePane];
                    result.push({
                        id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        openFileIds: [],
                        activeFileId: null,
                        direction: newDirection,
                        children
                    });
                }
            } else if (item.children && item.direction) {
                const newChildren = splitInTree(item.children, item.direction);
                if (newChildren !== item.children) {
                    processed = true;
                    if (newChildren.length === 1) {
                        result.push(newChildren[0]);
                    } else {
                        result.push({ ...item, children: newChildren });
                    }
                } else {
                    result.push(item);
                }
            } else {
                result.push(item);
            }
        }
        
        return processed ? result : items;
    }
    
    return splitInTree(panes);
}

export function usePaneManagement(
    panes: Pane[],
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>,
    _activePaneId: string,
    setActivePaneId: (id: string) => void,
    _files: FileData[],
    _setActiveFileId: (fileId: string | null) => void
): UsePaneManagementReturn {
    const generatePaneId = useCallback(() => {
        return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }, []);

    const removePane = useCallback((paneId: string) => {
        setPanes(prev => {
            const flattened = flattenPanes(prev);
            if (flattened.length <= 1) return prev;
            const newPanes = removePaneFromTree(prev, paneId);
            const newFlattened = flattenPanes(newPanes);
            if (newFlattened.length > 0 && paneId === _activePaneId) {
                setActivePaneId(newFlattened[0].id);
            }
            return newPanes;
        });
    }, [setPanes, _activePaneId, setActivePaneId]);

    const splitPane = useCallback((sourcePaneId: string, fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => {
        const newPaneId = generatePaneId();
        const sourcePane = findPane(panes, sourcePaneId);
        const fileToOpen = fileId || sourcePane?.activeFileId || null;
        
        const newPane: Pane = { 
            id: newPaneId, 
            openFileIds: fileToOpen ? [fileToOpen] : [],
            activeFileId: fileToOpen
        };
        
        const isHorizontal = position === 'left' || position === 'right';
        
        setPanes(prev => {
            return splitPaneInTree(prev, sourcePaneId, newPane, position, isHorizontal);
        });
        
        setActivePaneId(newPaneId);
    }, [panes, generatePaneId, setActivePaneId, setPanes]);

    return {
        splitPane,
        removePane
    };
}