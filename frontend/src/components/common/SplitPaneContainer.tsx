/**
 * SplitPaneContainer - Container with drop zones for split-screen functionality
 * 
 * Wraps pane content and provides visual drop zones for drag-and-drop operations.
 * Shows indicators where files can be dropped to create split layouts.
 */

import React from 'react';
import DropZone from './DropZone';
import { DragOverState } from '../../hooks/usePaneManagement';

export interface SplitPaneContainerProps {
    children: React.ReactNode;
    paneId: string;
    isActive: boolean;
    dragOverState: DragOverState | null;
    isDragging: boolean;
    onDragOver: (e: React.DragEvent, position: 'left' | 'right' | 'top' | 'bottom' | 'center') => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, position: 'left' | 'right' | 'top' | 'bottom' | 'center') => void;
    className?: string;
}

export const SplitPaneContainer: React.FC<SplitPaneContainerProps> = ({
    children,
    paneId,
    isActive,
    dragOverState,
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
    className = ''
}) => {
    const isDropTarget = dragOverState?.paneId === paneId;

    return (
        <div
            className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${className}`}
            onDragOver={(e) => {
                if (isDragging) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
        >
            {/* Drop zones - only visible when dragging */}
            {isDragging && (
                <>
                    <DropZone
                        position="left"
                        isActive={isDropTarget && dragOverState?.position === 'left'}
                        onDragOver={(e) => onDragOver(e, 'left')}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, 'left')}
                    />
                    <DropZone
                        position="right"
                        isActive={isDropTarget && dragOverState?.position === 'right'}
                        onDragOver={(e) => onDragOver(e, 'right')}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, 'right')}
                    />
                    <DropZone
                        position="top"
                        isActive={isDropTarget && dragOverState?.position === 'top'}
                        onDragOver={(e) => onDragOver(e, 'top')}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, 'top')}
                    />
                    <DropZone
                        position="bottom"
                        isActive={isDropTarget && dragOverState?.position === 'bottom'}
                        onDragOver={(e) => onDragOver(e, 'bottom')}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, 'bottom')}
                    />
                    <DropZone
                        position="center"
                        isActive={isDropTarget && dragOverState?.position === 'center'}
                        onDragOver={(e) => onDragOver(e, 'center')}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(e, 'center')}
                    />
                </>
            )}

            {/* Active pane indicator */}
            <div className={`flex-1 flex flex-col min-h-0 relative transition-all duration-200 ${
                isActive && !isDragging ? 'ring-1 ring-blue-500/30' : ''
            } ${
                isDropTarget ? 'ring-2 ring-blue-400/50' : ''
            }`}>
                {children}
            </div>
        </div>
    );
};

export default SplitPaneContainer;
