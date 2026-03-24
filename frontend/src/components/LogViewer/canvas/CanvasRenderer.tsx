/**
 * CanvasRenderer Component
 * Extracted from LogViewer.tsx lines 1004-1024
 */
import React, { RefObject } from 'react';

export interface CanvasRendererProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportWidth: number;
  viewportHeight: number;
  totalLines: number;
  startIndex: number;
  endIndex: number;
  isVisible: boolean;
  onDraw?: (ctx: CanvasRenderingContext2D) => void;
}

export const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  canvasRef,
  viewportWidth,
  viewportHeight,
  totalLines,
  startIndex,
  endIndex,
  isVisible,
}) => {
  const ariaLabel = `日志视图，共 ${totalLines.toLocaleString()} 行。当前显示第 ${startIndex + 1} 到 ${endIndex} 行`;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        overflow: 'visible',
        zIndex: 1,
      }}
    >
      <canvas
        ref={canvasRef}
        role="log"
        aria-label={ariaLabel}
        aria-readonly="true"
        tabIndex={0}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: viewportWidth,
          height: viewportHeight,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default CanvasRenderer;