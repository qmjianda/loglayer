/**
 * PaneHeader - File tab header with drag support
 * 
 * Displays the file name in a pane header with drag-and-drop functionality.
 * Users can drag the file tab to create split screens or move files between panes.
 */

import React, { useCallback } from 'react';
import { FileData } from '../../hooks/useFileManagement';

export interface PaneHeaderProps {
    file: FileData | undefined;
    paneId: string;
    isActive: boolean;
    isDragging?: boolean;
    onClose?: () => void;
    onDragStart?: (fileId: string) => void;
    onDragEnd?: () => void;
    onClick: () => void;
}

export const PaneHeader: React.FC<PaneHeaderProps> = ({
    file,
    paneId,
    isActive,
    isDragging,
    onClose,
    onDragStart,
    onDragEnd,
    onClick
}) => {
    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (file?.id) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', file.id);
            onDragStart(file.id);
        }
    }, [file?.id, onDragStart]);

    const handleDragEnd = useCallback(() => {
        onDragEnd();
    }, [onDragEnd]);

    if (!file) {
        return (
            <div className="h-8 bg-secondary flex items-center px-4 text-xs text-muted border-b border-subtle shrink-0 select-none">
                <span className="italic opacity-50">Empty Pane</span>
            </div>
        );
    }

    return (
        <div
            className={`h-8 bg-secondary flex items-center px-3 text-xs border-b border-subtle shrink-0 select-none cursor-grab active:cursor-grabbing transition-colors ${
                isActive ? 'bg-blue-600/20' : 'hover:bg-tertiary'
            } ${isDragging ? 'opacity-50' : 'opacity-100'}`}
            onClick={onClick}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            title={file.name}
        >
            {/* File icon */}
            <svg className="w-3.5 h-3.5 mr-2 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            
            {/* File name */}
            <span className="truncate flex-1 text-foreground">{file.name}</span>
            
            {/* Drag handle indicator */}
            <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="2" d="M4 8h16M4 16h16" />
                </svg>
            </div>
            
            {/* Close button */}
            {onClose && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-60 hover:opacity-100"
                    title="Close pane"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default PaneHeader;
