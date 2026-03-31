/**
 * usePaneManagement - Pane state and split view operations
 * 
 * Manages pane list, active pane, and pane split/remove operations.
 */

import React, { useState, useCallback } from 'react';

export const MAX_PANES = 99;

// Pane interface
export interface Pane {
    id: string;
    openFileIds: string[];
    activeFileId: string | null;
    direction?: 'horizontal' | 'vertical';
    children?: Pane[];
    findVisible?: boolean;
    goToLineVisible?: boolean;
    searchQuery?: string;
    searchConfig?: {
        regex: boolean;
        caseSensitive: boolean;
    };
    scrollToIndex?: number | null;
    searchMatchCount?: number;
    currentMatchRank?: number;
}

export function createPane(id?: string): Pane {
    return {
        id: id || `pane-${Date.now()}`,
        openFileIds: [],
        activeFileId: null,
        findVisible: false,
        goToLineVisible: false,
        searchQuery: '',
        searchConfig: { regex: false, caseSensitive: false },
        scrollToIndex: null,
        currentMatchRank: -1
    };
}

// Utility functions for pane tree manipulation
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

export interface UsePaneManagementReturn {
    // Pane state
    panes: Pane[];
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
    activePaneId: string;
    setActivePaneId: (id: string) => void;

    // Pane operations
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

export function usePaneManagement(): UsePaneManagementReturn {
    // Pane state
    const [panes, setPanes] = useState<Pane[]>([createPane('pane-1')]);
    const [activePaneId, setActivePaneId] = useState<string>('pane-1');

    const generatePaneId = useCallback(() => {
        return `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }, []);

    const removePane = useCallback((paneId: string) => {
        setPanes(prev => {
            const flattened = flattenPanes(prev);
            if (flattened.length <= 1) return prev;
            const newPanes = removePaneFromTree(prev, paneId);
            const newFlattened = flattenPanes(newPanes);
            if (newFlattened.length > 0 && paneId === activePaneId) {
                setActivePaneId(newFlattened[0].id);
            }
            return newPanes;
        });
    }, [activePaneId]);

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
    }, [panes, generatePaneId]);

    return {
        panes,
        setPanes,
        activePaneId,
        setActivePaneId,
        splitPane,
        removePane
    };
}
