/**
 * TabBar - Multiple file tabs per pane
 * 
 * VS Code-style tab bar supporting multiple open files per pane.
 * Each pane can have multiple tabs open, with one active.
 */

import React, { useState, useCallback, useRef } from 'react';
import { FileData } from '../../hooks/useFileManagement';
import { TabItem } from './TabItem';
import { TabContextMenu } from './TabContextMenu';

export interface TabBarProps {
    openFileIds: string[];
    activeFileId: string | null;
    files: FileData[];
    paneId: string;
    isPaneActive: boolean;
    onTabClick: (fileId: string) => void;
    onTabClose: (paneId: string, fileId: string) => void;
    onPaneClick?: () => void;
    onTabsReorder?: (paneId: string, fromIndex: number, toIndex: number) => void;
    onTabDragStart?: (fileId: string, e: React.DragEvent) => void;
    onTabDragEnd?: (e: React.DragEvent) => void;
    onCloseTab?: (paneId: string, fileId: string) => void;
    onCloseOtherTabs?: (keepFileId: string) => void;
    onCloseAllTabs?: () => void;
    onSplitTabRight?: (fileId: string) => void;
    onSplitTabDown?: (fileId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
    openFileIds,
    activeFileId,
    files,
    paneId,
    isPaneActive,
    onTabClick,
    onTabClose,
    onPaneClick,
    onTabsReorder,
    onTabDragStart,
    onTabDragEnd,
    onCloseTab,
    onCloseOtherTabs,
    onCloseAllTabs,
    onSplitTabRight,
    onSplitTabDown
}) => {
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const openFiles = openFileIds
        .map(id => files.find(f => f.id === id))
        .filter((f): f is FileData => f !== undefined);

    const handleDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
            setDragOverIndex(targetIndex);
        }
    }, [draggedIndex]);

    const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        
        if (draggedIndex !== null && draggedIndex !== targetIndex && onTabsReorder) {
            onTabsReorder(paneId, draggedIndex, targetIndex);
        }
        
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, [draggedIndex, onTabsReorder, paneId]);

    const handleItemDragStart = useCallback((fileId: string, e: React.DragEvent) => {
        const index = openFileIds.indexOf(fileId);
        setDraggedIndex(index);
        onTabDragStart?.(fileId, e);
    }, [openFileIds, onTabDragStart]);

    const handleItemDragEnd = useCallback((e: React.DragEvent) => {
        setDraggedIndex(null);
        setDragOverIndex(null);
        onTabDragEnd?.(e);
    }, [onTabDragEnd]);

    if (openFiles.length === 0) {
        return (
            <div 
                className="h-8 bg-secondary flex items-center px-4 text-xs text-muted border-b border-subtle shrink-0 select-none"
                onClick={onPaneClick}
            >
                <span className="italic opacity-50">No open files</span>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className="flex items-center bg-secondary border-b border-subtle shrink-0 overflow-x-auto overflow-y-hidden"
        >
            {openFiles.map((file, index) => (
                <div
                    key={file.id}
                    className={`relative ${dragOverIndex === index ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500' : ''}`}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                >
                    <TabContextMenu
                        trigger={
                            <TabItem
                                file={file}
                                isActive={file.id === activeFileId}
                                isPaneActive={isPaneActive}
                                paneId={paneId}
                                onClick={() => onTabClick(file.id)}
                                onClose={(e) => {
                                    e.stopPropagation();
                                    onTabClose(paneId, file.id);
                                }}
                                onDragStart={(e) => handleItemDragStart(file.id, e)}
                                onDragEnd={handleItemDragEnd}
                                isFirst={index === 0}
                                isLast={index === openFiles.length - 1}
                            />
                        }
onClose={() => {
                             onCloseTab?.(paneId, file.id);
                         }}
                        onCloseOthers={() => onCloseOtherTabs?.(file.id)}
                        onCloseAll={() => onCloseAllTabs?.()}
                        onSplitRight={() => onSplitTabRight?.(file.id)}
                        onSplitDown={() => onSplitTabDown?.(file.id)}
                        canClose={openFiles.length > 1}
                    />
                </div>
            ))}
        </div>
    );
};

export default TabBar;