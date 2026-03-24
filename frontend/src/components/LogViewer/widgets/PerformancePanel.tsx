/**
 * Performance Panel Widget
 * 
 * Displays FPS, visible line count, and memory usage.
 * Extracted from LogViewer.tsx for better modularity.
 */

import React from 'react';

// Mirror: backend/loglayer/schemas.py::PerformanceStats
interface PerformanceStats {
  fps: number;
  visibleLines: number;
  memory: number;
}

interface PerformancePanelProps {
  performanceStats: PerformanceStats;
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Get FPS color based on performance
 */
const getFpsColor = (fps: number): string => {
  if (fps < 30) return 'text-[var(--color-error)]';
  if (fps < 50) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-success)]';
};

export const PerformancePanel: React.FC<PerformancePanelProps> = ({
  performanceStats,
  isVisible,
  onToggle,
}) => {
  const { fps, visibleLines, memory } = performanceStats;
  const fpsColorClass = getFpsColor(fps);

  return (
    <>
      {isVisible && (
        <div className="fixed bottom-2 right-2 bg-elevated text-xs p-2 rounded z-[1000] text-secondary font-mono border border-default">
          <div className="flex gap-3">
            <span>
              FPS: <span className={fpsColorClass}>{fps}</span>
            </span>
            <span>Lines: {visibleLines.toLocaleString()}</span>
            <span>Mem: {memory}MB</span>
          </div>
        </div>
      )}

      <button
        className="fixed bottom-8 right-2 text-[10px] text-muted hover:text-secondary z-[1000] transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {isVisible ? 'Hide' : 'Perf'}
      </button>
    </>
  );
};