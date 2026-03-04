/**
 * DropZone - Visual indicator for drag-and-drop operations
 * 
 * Shows drop zones around panes to indicate where files can be dropped
 * to create split-screen layouts.
 */

import React from 'react';

export interface DropZoneProps {
    position: 'left' | 'right' | 'top' | 'bottom' | 'center';
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
    const baseClasses = "absolute z-50 transition-all duration-150 pointer-events-auto";
    
    const positionClasses = {
        left: "left-0 top-0 bottom-0 w-1/3 hover:bg-blue-500/20",
        right: "right-0 top-0 bottom-0 w-1/3 hover:bg-blue-500/20",
        top: "top-0 left-0 right-0 h-1/3 hover:bg-blue-500/20",
        bottom: "bottom-0 left-0 right-0 h-1/3 hover:bg-blue-500/20",
        center: "inset-0 bg-blue-500/10 hover:bg-blue-500/20"
    };

    const activeClasses = isActive 
        ? "bg-blue-500/30 border-2 border-blue-400" 
        : "bg-transparent border-0";

    const iconClasses = "absolute inset-0 flex items-center justify-center pointer-events-none";
    
    const icons = {
        left: (
            <svg className="w-8 h-8 text-blue-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M9 18l6-6-6-6" />
            </svg>
        ),
        right: (
            <svg className="w-8 h-8 text-blue-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M15 18l-6-6 6-6" />
            </svg>
        ),
        top: (
            <svg className="w-8 h-8 text-blue-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M18 9l-6 6-6-6" />
            </svg>
        ),
        bottom: (
            <svg className="w-8 h-8 text-blue-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" d="M6 15l6-6 6 6" />
            </svg>
        ),
        center: (
            <svg className="w-12 h-12 text-blue-400 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {isActive && (
                <div className={iconClasses}>
                    {icons[position]}
                </div>
            )}
        </div>
    );
};

export default DropZone;
