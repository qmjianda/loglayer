import React from 'react';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { HelpPanel } from './HelpPanel';
import { LogViewerPane } from './LogViewerPane';
import { Pane, FileData, findPaneRecursive, updatePaneInTree } from '../hooks/useFileManagement';

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
            result.push(pane);
        }
    }
    return result;
}

function cleanupEmptyPanes(panes: Pane[]): Pane[] {
    const flattened = flattenPanes(panes);
    if (flattened.length <= 1) return panes;
    
    function clean(items: Pane[]): Pane[] {
        const result: Pane[] = [];
        for (const item of items) {
            if (item.children) {
                const newChildren = clean(item.children);
                if (newChildren.length === 0) continue;
                if (newChildren.length === 1 && !newChildren[0].children) {
                    result.push(newChildren[0]);
                } else {
                    result.push({ ...item, children: newChildren });
                }
            } else if (item.openFileIds && item.openFileIds.length > 0) {
                result.push(item);
            }
        }
        return result;
    }
    
    return clean(panes);
}

function handleDragSplit(
    panes: Pane[],
    sourcePaneId: string,
    targetPaneId: string,
    fileId: string,
    newPaneId: string,
    position: string
): Pane[] {
    const isHorizontal = position === 'left' || position === 'right';
    const newDirection = isHorizontal ? 'horizontal' : 'vertical';
    
    const newPane: Pane = {
        id: newPaneId,
        openFileIds: [fileId],
        activeFileId: fileId
    };
    
    function processTree(items: Pane[], parentDirection?: string): Pane[] {
        const result: Pane[] = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.id === sourcePaneId && item.id === targetPaneId) {
                const newOpenFileIds = item.openFileIds?.filter(id => id !== fileId) || [];
                const newActiveId = item.activeFileId === fileId 
                    ? (newOpenFileIds[0] || null) 
                    : item.activeFileId;
                const updatedSource = { ...item, openFileIds: newOpenFileIds, activeFileId: newActiveId };
                
                if (newOpenFileIds.length > 0) {
                    const children = position === 'right' || position === 'bottom'
                        ? [updatedSource, newPane]
                        : [newPane, updatedSource];
                    result.push({
                        id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        openFileIds: [],
                        activeFileId: null,
                        direction: newDirection,
                        children
                    });
                } else {
                    result.push(newPane);
                }
            } else if (item.id === sourcePaneId) {
                const newOpenFileIds = item.openFileIds?.filter(id => id !== fileId) || [];
                if (newOpenFileIds.length > 0) {
                    const newActiveId = item.activeFileId === fileId 
                        ? (newOpenFileIds[0] || null) 
                        : item.activeFileId;
                    result.push({ ...item, openFileIds: newOpenFileIds, activeFileId: newActiveId });
                }
            } else if (item.id === targetPaneId) {
                const targetPane = item;
                
                if (parentDirection && parentDirection === newDirection) {
                    if (position === 'right' || position === 'bottom') {
                        result.push(targetPane);
                        result.push(newPane);
                    } else {
                        result.push(newPane);
                        result.push(targetPane);
                    }
                } else {
                    const children = position === 'right' || position === 'bottom'
                        ? [targetPane, newPane]
                        : [newPane, targetPane];
                    result.push({
                        id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        openFileIds: [],
                        activeFileId: null,
                        direction: newDirection,
                        children
                    });
                }
            } else if (item.children && item.direction) {
                const newChildren = processTree(item.children, item.direction);
                if (newChildren.length === 1 && !newChildren[0].children) {
                    result.push(newChildren[0]);
                } else if (newChildren.length > 0) {
                    result.push({ ...item, children: newChildren });
                }
            } else {
                result.push(item);
            }
        }
        
        return result;
    }
    
    return processTree(panes);
}

function renderPaneTree(
    panes: Pane[],
    parentOrientation: 'horizontal' | 'vertical',
    files: FileData[],
    activePaneId: string,
    activeView: string,
    searchQuery: string,
    searchConfig: { regex: boolean; caseSensitive: boolean },
    searchMatchCount: number,
    currentMatchNumber: number,
    processedCache: any,
    scrollToIndex: number | null,
    highlightedIndex: number | null,
    indexingFileIds: Set<string>,
    pendingCliFiles: number,
    bridgedUpdateTrigger: number,
    settings: any,
    resolvedTheme: any,
    hasNewContent: boolean,
    setActivePaneId: (id: string) => void,
    handleTabClick: (paneId: string, fileId: string) => void,
    handleTabClose: (paneId: string, fileId: string) => void,
    handleTabsReorder: (paneId: string, fromIndex: number, toIndex: number) => void,
    handleCloseTab: (paneId: string, fileId: string) => void,
    handleCloseOtherTabs: (paneId: string, keepFileId: string) => void,
    handleCloseAllTabs: (paneId: string) => void,
    handleSplitTabRight: (paneId: string, fileId: string) => void,
    handleSplitTabDown: (paneId: string, fileId: string) => void,
    setHighlightedIndex: (index: number | null) => void,
    addLayer: (type: any, config?: any) => void,
    handleToggleBookmark: (lineIndex: number) => void,
    handleUpdateBookmarkComment: (lineIndex: number, comment: string) => void,
    setCanvasSelectedText: (text: string) => void,
    setActiveView: (view: any) => void,
    clearNewContent: () => void,
    setScrollToIndex: (index: number | null) => void,
    activeFile: { lineCount?: number } | null,
    removePane: (paneId: string) => void,
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>,
    handleOpen: () => void,
    onQueryChange: (query: string) => void,
    onConfigChange: (config: any) => void,
    onNavigate: (direction: 'next' | 'prev') => void,
    onGoToLine: (lineNum: number) => void,
    onToggleFind: (paneId: string, visible: boolean) => void,
    onToggleGoToLine: (paneId: string, visible: boolean) => void,
    clearSearch: () => void,
    setProcessedCache: any
): React.ReactNode {
    return panes.map((pane, index) => {
        const isLastPane = index === panes.length - 1;
        
        if (pane.children && pane.direction) {
            return (
                <React.Fragment key={pane.id}>
                    <Panel id={pane.id} minSize={20}>
                        <Group orientation={pane.direction} className="h-full">
                            {renderPaneTree(
                                pane.children,
                                pane.direction,
                                files,
                                activePaneId,
                                activeView,
                                searchQuery,
                                searchConfig,
                                searchMatchCount,
                                currentMatchNumber,
                                processedCache,
                                scrollToIndex,
                                highlightedIndex,
                                indexingFileIds,
                                pendingCliFiles,
                                bridgedUpdateTrigger,
                                settings,
                                resolvedTheme,
                                hasNewContent,
                                setActivePaneId,
                                handleTabClick,
                                handleTabClose,
                                handleTabsReorder,
                                handleCloseTab,
                                handleCloseOtherTabs,
                                handleCloseAllTabs,
                                handleSplitTabRight,
                                handleSplitTabDown,
                                setHighlightedIndex,
                                addLayer,
                                handleToggleBookmark,
                                handleUpdateBookmarkComment,
                                setCanvasSelectedText,
                                setActiveView,
                                clearNewContent,
                                setScrollToIndex,
                                activeFile,
                                removePane,
                                setPanes,
                                handleOpen,
                                onQueryChange,
                                onConfigChange,
                                onNavigate,
                                onGoToLine,
                                onToggleFind,
                                onToggleGoToLine,
                                clearSearch,
                                setProcessedCache
                            )}
                        </Group>
                    </Panel>
                    {!isLastPane && <Separator className={`bg-[var(--border-subtle)] hover:bg-blue-500 ${parentOrientation === 'vertical' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'}`} />}
                </React.Fragment>
            );
        }
        
        const paneFileId = pane.activeFileId;
        const paneFile = files.find(f => f.id === paneFileId);
        const isPaneActive = activePaneId === pane.id;
        const allPanes = flattenPanes(panes);
        const paneSearchMatchCount = pane.activeFileId ? (processedCache[pane.activeFileId]?.searchMatchCount || 0) : 0;
        
        return (
            <React.Fragment key={pane.id}>
                <Panel id={pane.id} minSize={20}>
                    <LogViewerPane
                        pane={pane}
                        paneFile={paneFile}
                        files={files}
                        isPaneActive={isPaneActive}
                        activeView={activeView}
                        searchQuery={searchQuery}
                        searchConfig={searchConfig}
                        searchMatchCount={paneSearchMatchCount}
                        currentMatchNumber={currentMatchNumber}
                        processedCache={processedCache}
                        scrollToIndex={isPaneActive ? scrollToIndex : null}
                        highlightedIndex={isPaneActive ? highlightedIndex : null}
                        indexingFileIds={indexingFileIds}
                        pendingCliFiles={pendingCliFiles}
                        bridgedUpdateTrigger={bridgedUpdateTrigger}
                        settings={settings}
                        resolvedTheme={resolvedTheme}
                        hasNewContent={hasNewContent}
                        canClose={allPanes.length > 1}
                        onTabClick={(fileId) => {
                            if (!isPaneActive) setActivePaneId(pane.id);
                            handleTabClick(pane.id, fileId);
                        }}
                        onTabClose={(_paneId, fileId) => {
                            handleTabClose(pane.id, fileId);
                        }}
                        onTabsReorder={(paneId, fromIndex, toIndex) => handleTabsReorder(paneId, fromIndex, toIndex)}
                        onCloseTab={handleCloseTab}
                        onCloseOtherTabs={(keepFileId: string) => handleCloseOtherTabs(pane.id, keepFileId)}
                        onCloseAllTabs={() => handleCloseAllTabs(pane.id)}
                        onSplitTabRight={(fileId: string) => handleSplitTabRight(pane.id, fileId)}
                        onSplitTabDown={(fileId: string) => handleSplitTabDown(pane.id, fileId)}
                        onLineClick={(idx) => {
                            if (!isPaneActive) setActivePaneId(pane.id);
                            setHighlightedIndex(idx);
                        }}
                        onAddLayer={addLayer}
                        onToggleBookmark={handleToggleBookmark}
                        onUpdateBookmarkComment={handleUpdateBookmarkComment}
                        onSelectedTextChange={setCanvasSelectedText}
                        onScrollToNewContent={() => {
                            clearNewContent();
                            if (activeFile?.lineCount) {
                                setScrollToIndex(activeFile.lineCount - 1);
                            }
                        }}
                        onPaneClose={() => {
                            removePane(pane.id);
                        }}
                        onPaneDragEnd={(fileId, position, sourcePaneId) => {
                            if (position && fileId && sourcePaneId) {
                                const newPaneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                                setPanes(prev => {
                                    const newPanes = handleDragSplit(prev, sourcePaneId, pane.id, fileId, newPaneId, position);
                                    return cleanupEmptyPanes(newPanes);
                                });
                                setActivePaneId(newPaneId);
                            }
                        }}
                        onPaneClick={() => setActivePaneId(pane.id)}
                        onOpen={handleOpen}
                        onQueryChange={onQueryChange}
                        onConfigChange={onConfigChange}
                        onNavigate={onNavigate}
                        onGoToLine={(lineNum) => {
                            onGoToLine(lineNum);
                            onToggleGoToLine(pane.id, false);
                        }}
                        onToggleFind={(visible) => onToggleFind(pane.id, visible)}
                        onToggleGoToLine={(visible) => onToggleGoToLine(pane.id, visible)}
                        clearSearch={clearSearch}
                        setProcessedCache={setProcessedCache}
                    />
                </Panel>
                {!isLastPane && <Separator className={`bg-[var(--border-subtle)] hover:bg-blue-500 ${parentOrientation === 'vertical' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize'}`} />}
            </React.Fragment>
        );
    });
}

interface MainContentProps {
    activeView: string;
    searchQuery: string;
    searchConfig: { regex: boolean; caseSensitive: boolean };
    searchMatchCount: number;
    currentMatchNumber: number;
    activeFile: { lineCount?: number } | null;
    activeFileId: string | null;
    processedCache: any;
    setSearchQuery: (query: string) => void;
    setSearchConfig: (config: any) => void;
    findNextSearchMatchWithJump: (direction: 'next' | 'prev') => void;
    handleJumpToLine: (line: number, total: number) => void;
    clearSearch: () => void;
    setProcessedCache: any;
    panes: Pane[];
    setPanes: React.Dispatch<React.SetStateAction<Pane[]>>;
    files: FileData[];
    activePaneId: string;
    scrollToIndex: number | null;
    highlightedIndex: number | null;
    setHighlightedIndex: (index: number | null) => void;
    indexingFileIds: Set<string>;
    pendingCliFiles: number;
    bridgedUpdateTrigger: number;
    settings: any;
    resolvedTheme: any;
    hasNewContent: boolean;
    setActivePaneId: (id: string) => void;
    addLayer: (type: any, config?: any) => void;
    handleToggleBookmark: (lineIndex: number) => void;
    handleUpdateBookmarkComment: (lineIndex: number, comment: string) => void;
    setCanvasSelectedText: (text: string) => void;
    setActiveView: (view: any) => void;
    clearNewContent: () => void;
    setScrollToIndex: (index: number | null) => void;
    removePane: (paneId: string) => void;
    splitPane: (sourcePaneId: string, fileId?: string, position?: 'left' | 'right' | 'top' | 'bottom') => void;
    handleOpen: () => void;
    onToggleFind: (paneId: string, visible: boolean) => void;
    onToggleGoToLine: (paneId: string, visible: boolean) => void;
    onCloseTab?: (paneId: string, fileId: string) => void;
    onCloseOtherTabs?: (paneId: string, keepFileId: string) => void;
    onCloseAllTabs?: (paneId: string) => void;
    onSplitTabRight?: (paneId: string, fileId: string) => void;
    onSplitTabDown?: (paneId: string, fileId: string) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
    activeView,
    searchQuery,
    searchConfig,
    searchMatchCount,
    currentMatchNumber,
    activeFile,
    activeFileId,
    processedCache,
    setSearchQuery,
    setSearchConfig,
    findNextSearchMatchWithJump,
    handleJumpToLine,
    clearSearch,
    setProcessedCache,
    panes,
    setPanes,
    files,
    activePaneId,
    scrollToIndex,
    highlightedIndex,
    setHighlightedIndex,
    indexingFileIds,
    pendingCliFiles,
    bridgedUpdateTrigger,
    settings,
    resolvedTheme,
    hasNewContent,
    setActivePaneId,
    addLayer,
    handleToggleBookmark,
    handleUpdateBookmarkComment,
    setCanvasSelectedText,
    setActiveView,
    clearNewContent,
    setScrollToIndex,
    removePane,
    splitPane,
    handleOpen,
    onToggleFind,
    onToggleGoToLine,
    onCloseTab,
    onCloseOtherTabs,
    onCloseAllTabs,
    onSplitTabRight,
    onSplitTabDown
}) => {
    const { defaultLayout, onLayoutChanged } = useDefaultLayout({
        id: 'main-pane-group',
        storage: localStorage
    });

    const handleTabClick = (paneId: string, fileId: string) => {
        setPanes(prev => {
            return updatePaneInTree(prev, paneId, (p) => {
                const openFileIds = p.openFileIds?.includes(fileId)
                    ? p.openFileIds
                    : [...(p.openFileIds || []), fileId];
                return { ...p, openFileIds, activeFileId: fileId };
            });
        });
    };

    const handleTabClose = (paneId: string, fileId: string) => {
        setPanes(prev => {
            const pane = findPaneRecursive(prev, paneId);
            if (!pane || !pane.openFileIds?.includes(fileId)) return prev;
            
            const openFileIds = pane.openFileIds.filter(id => id !== fileId);
            const flattened = flattenPanes(prev);
            
            if (openFileIds.length === 0) {
                if (flattened.length > 1) {
                    const newPanes = removePaneFromTree(prev, paneId);
                    const newFlattened = flattenPanes(newPanes);
                    if (paneId === activePaneId && newFlattened.length > 0) {
                        setActivePaneId(newFlattened[0].id);
                    }
                    return newPanes;
                }
                return updatePaneInTree(prev, paneId, (p) => ({ ...p, openFileIds: [], activeFileId: null }));
            }
            
            const newActiveId = pane.activeFileId === fileId 
                ? openFileIds[openFileIds.length - 1]
                : pane.activeFileId;
            
            return updatePaneInTree(prev, paneId, (p) => ({ ...p, openFileIds, activeFileId: newActiveId }));
        });
    };

    const handleTabsReorder = (paneId: string, fromIndex: number, toIndex: number) => {
        setPanes(prev => updatePaneInTree(prev, paneId, (p) => {
            const newOpenFileIds = [...(p.openFileIds || [])];
            const [removed] = newOpenFileIds.splice(fromIndex, 1);
            newOpenFileIds.splice(toIndex, 0, removed);
            return { ...p, openFileIds: newOpenFileIds };
        }));
    };

    const handleCloseTab = (paneId: string, fileId: string) => {
        if (onCloseTab) {
            onCloseTab(paneId, fileId);
        } else {
            handleTabClose(paneId, fileId);
        }
    };

    const handleCloseOtherTabs = (paneId: string, keepFileId: string) => {
        if (onCloseOtherTabs) {
            onCloseOtherTabs(paneId, keepFileId);
        } else {
            setPanes(prev => updatePaneInTree(prev, paneId, (p) => ({ ...p, openFileIds: [keepFileId], activeFileId: keepFileId })));
        }
    };

    const handleCloseAllTabs = (paneId: string) => {
        if (onCloseAllTabs) {
            onCloseAllTabs(paneId);
        } else {
            setPanes(prev => updatePaneInTree(prev, paneId, (p) => ({ ...p, openFileIds: [], activeFileId: null })));
        }
    };

    const handleSplitTabRight = (paneId: string, fileId: string) => {
        if (onSplitTabRight) {
            onSplitTabRight(paneId, fileId);
        } else {
            splitPane(paneId, fileId, 'right');
        }
    };

    const handleSplitTabDown = (paneId: string, fileId: string) => {
        if (onSplitTabDown) {
            onSplitTabDown(paneId, fileId);
        } else {
            splitPane(paneId, fileId, 'bottom');
        }
    };

    return (
        <main
            role="main"
            aria-label="Main content"
            className="flex-1 flex flex-col min-w-0 min-h-0 bg-theme-base relative select-text overflow-hidden"
        >
            {activeView === 'help' ? (
                <HelpPanel />
            ) : (
                <Group 
                    className="flex-1" 
                    id="main-pane-group"
                    defaultLayout={defaultLayout}
                    onLayoutChanged={onLayoutChanged}
                >
                    {renderPaneTree(
                        panes,
                        'horizontal',
                        files,
                        activePaneId,
                        activeView,
                        searchQuery,
                        searchConfig,
                        searchMatchCount,
                        currentMatchNumber,
                        processedCache,
                        scrollToIndex,
                        highlightedIndex,
                        indexingFileIds,
                        pendingCliFiles,
                        bridgedUpdateTrigger,
                        settings,
                        resolvedTheme,
                        hasNewContent,
                        setActivePaneId,
                        handleTabClick,
                        handleTabClose,
                        handleTabsReorder,
                        handleCloseTab,
                        handleCloseOtherTabs,
                        handleCloseAllTabs,
                        handleSplitTabRight,
                        handleSplitTabDown,
                        setHighlightedIndex,
                        addLayer,
                        handleToggleBookmark,
                        handleUpdateBookmarkComment,
                        setCanvasSelectedText,
                        setActiveView,
                        clearNewContent,
                        setScrollToIndex,
                        activeFile,
                        removePane,
                        setPanes,
                        handleOpen,
                        setSearchQuery,
                        setSearchConfig,
                        findNextSearchMatchWithJump,
                        (lineNum) => handleJumpToLine(lineNum - 1, activeFile?.lineCount || 0),
                        onToggleFind,
                        onToggleGoToLine,
                        clearSearch,
                        setProcessedCache
                    )}
                </Group>
            )}
        </main>
    );
};
