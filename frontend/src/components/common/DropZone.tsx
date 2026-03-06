/**
 * DropZone - Visual indicator for drag-and-drop operations
 * 
 * Shows drop zones around panes to indicate where files can be dropped
 * to create split-screen layouts.
 */

import React from 'react';

export type DropZonePosition = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface DropZoneProps {
    position: DropZonePosition;
    isActive: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
    position,
    isActive,
    onDragOver,
    onDragLeave,
    onDrop
}) => {
    const baseClasses = "absolute z-50 transition-all duration-150 pointer-events-auto flex items-center justify-center rounded";
    
    const positionClasses = {
        left: "left-0 top-0 bottom-0 w-2/5 ml-1",
        right: "right-0 top-0 bottom-0 w-2/5 mr-1",
        top: "top-0 left-0 right-0 h-2/5 mt-1",
        bottom: "bottom-0 left-0 right-0 h-2/5 mb-1",
        center: "inset-0"
    };

    const activeClasses = isActive 
        ? "bg-blue-500/40 border-2 border-blue-400 shadow-lg" 
        : "bg-blue-500/10 border border-blue-300/30 hover:bg-blue-500/20";

    const iconClasses = "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150";
    
    const icons = {
        left: (
            <svg className={`w-8 h-8 text-blue-400 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M9 18l6-6-6-6" />
            </svg>
        ),
        right: (
            <svg className={`w-8 h-8 text-blue-400 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M15 18l-6-6 6-6" />
            </svg>
        ),
        top: (
            <svg className={`w-8 h-8 text-blue-400 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M18 9l-6 6-6-6" />
            </svg>
        ),
        bottom: (
            <svg className={`w-8 h-8 text-blue-400 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M6 15l6-6 6 6" />
            </svg>
        ),
        center: (
            <svg className={`w-12 h-12 text-blue-400 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
        )
    };

    return (
        <div
            className={`${baseClasses} ${positionClasses[position]} ${activeClasses}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Always show icon (faint when not active, bright when active) */}
            <div className={iconClasses}>
                {icons[position]}
            </div>
            {/* Show position label */}
            <span className={`relative z-10 text-xs font-medium text-blue-300 transition-opacity duration-150 ${isActive ? 'opacity-100' : 'opacity-50'}`}>
                {position === 'center' ? '替换' : position === 'left' ? '左分屏' : position === 'right' ? '右分屏' : position === 'top' ? '上分屏' : '下分屏'}
            </span>
        </div>
    );
};

export default DropZone;
