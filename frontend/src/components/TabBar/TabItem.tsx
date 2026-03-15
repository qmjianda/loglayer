import React from 'react';
import { FileText, X } from 'lucide-react';
import { FileData } from '../../hooks/useFileManagement';

export interface TabItemProps {
    file: FileData;
    isActive: boolean;
    isPaneActive: boolean;
    paneId?: string;
    onClick: () => void;
    onClose: (e: React.MouseEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    isFirst?: boolean;
    isLast?: boolean;
}

export const TabItem: React.FC<TabItemProps> = ({
    file,
    isActive,
    isPaneActive,
    paneId,
    onClick,
    onClose,
    onDragStart,
    onDragEnd,
    isFirst,
    isLast
}) => {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', file.id);
        if (paneId) {
            e.dataTransfer.setData('application/x-pane-id', paneId);
        }
        onDragStart?.(e);
    };

    const handleMiddleClick = (e: React.MouseEvent) => {
        if (e.button === 1) {
            e.preventDefault();
            onClose(e);
        }
    };

    return (
        <div
            className={`
                group flex items-center h-8 px-3 text-xs border-r border-subtle cursor-grab 
                active:cursor-grabbing select-none transition-colors min-w-0 max-w-[160px]
                ${isActive 
                    ? 'bg-blue-600/20 text-foreground border-b-2 border-b-blue-500' 
                    : 'bg-secondary hover:bg-tertiary text-muted hover:text-foreground'
                }
                ${isPaneActive ? '' : 'opacity-60'}
            `}
            onClick={onClick}
            onMouseDown={handleMiddleClick}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            title={file.path || file.name}
        >
            <FileText className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
            <span className="truncate flex-1">{file.name}</span>
            <button
                onClick={onClose}
                className={`
                    ml-2 p-0.5 rounded transition-colors flex-shrink-0
                    hover:bg-red-500/20 hover:text-red-400
                    ${isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'}
                `}
                title="Close tab"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};

export default TabItem;