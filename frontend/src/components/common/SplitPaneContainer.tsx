/**
 * SplitPaneContainer - Container with drop zones for split-screen functionality
 * 
 * Wraps pane content and provides visual drop zones for drag-and-drop operations.
 * Shows indicators where files can be dropped to create split-screen layouts.
 */

import React, { useRef, useState } from 'react';
import DropZone, { DropZonePosition } from './DropZone';
import { DragOverState } from '../../hooks/usePaneManagement';

export interface SplitPaneContainerProps {
    children: React.ReactNode;
    paneId: string;
    isActive: boolean;
    dragOverState: DragOverState | null;
    isDragging: boolean;
    onDragOver: (e: React.DragEvent, position: DropZonePosition) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, position: DropZonePosition) => void;
    className?: string;
    style?: React.CSSProperties;
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
    className = '',
    style
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDropTarget = dragOverState?.paneId === paneId;
    
    // Determine which position to highlight based on mouse position within container
    const getPositionFromPoint = (clientX: number, clientY: number): DropZonePosition | null => {
        if (!containerRef.current) return null;
        
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const width = rect.width;
        const height = rect.height;
        
        // Calculate which zone the cursor is in
        // Use 30% threshold for edge zones
        const edgeThreshold = 0.30;
        
        const inLeft = x < width * edgeThreshold;
        const inRight = x > width * (1 - edgeThreshold);
        const inTop = y < height * edgeThreshold;
        const inBottom = y > height * (1 - edgeThreshold);
        
        if (inLeft) return 'left';
        if (inRight) return 'right';
        if (inTop) return 'top';
        if (inBottom) return 'bottom';
        
        return 'center';
    };
    
    const handleContainerDragOver = (e: React.DragEvent) => {
        if (!isDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Determine position from cursor
        const position = getPositionFromPoint(e.clientX, e.clientY);
        if (position) {
            onDragOver(e, position);
        }
    };
    
    const handleContainerDrop = (e: React.DragEvent) => {
        if (!isDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const position = getPositionFromPoint(e.clientX, e.clientY);
        if (position) {
            onDrop(e, position);
        }
    };

    return (
        <div
            ref={containerRef}
            className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${className}`}
            style={style}
            onDragOver={handleContainerDragOver}
            onDrop={handleContainerDrop}
        >
            {/* Drop zones - larger target areas for easier dropping */}
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
