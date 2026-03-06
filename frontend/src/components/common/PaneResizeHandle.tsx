import React, { useCallback, useState } from 'react';

export interface PaneResizeHandleProps {
    direction: 'horizontal' | 'vertical';
    onResize: (delta: number) => void;
    index: number;
    totalPanes: number;
}

export const PaneResizeHandle: React.FC<PaneResizeHandleProps> = ({
    direction,
    onResize,
    index,
    totalPanes
}) => {
    const [isResizing, setIsResizing] = useState(false);
    const startPosRef = React.useRef(0);
    const startSizeRef = React.useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
            const delta = currentPos - startPosRef.current;
            onResize(delta);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [direction, onResize]);

    const isHorizontal = direction === 'horizontal';
    const baseClasses = isHorizontal 
        ? "w-1 cursor-col-resize hover:bg-blue-500/50 bg-subtle transition-colors shrink-0"
        : "h-1 cursor-row-resize hover:bg-blue-500/50 bg-subtle transition-colors shrink-0";

    return (
        <div
            className={`${baseClasses} ${isResizing ? 'bg-blue-500' : ''} z-40`}
            onMouseDown={handleMouseDown}
            title={isHorizontal ? '拖拽调整宽度' : '拖拽调整高度'}
        />
    );
};

export default PaneResizeHandle;