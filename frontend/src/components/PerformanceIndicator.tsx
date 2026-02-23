import React from 'react';
import { PerformanceMetrics } from '../hooks/usePerformanceOptimization';

interface PerformanceIndicatorProps {
  metrics: PerformanceMetrics;
  visible: boolean;
}

export const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({ metrics, visible }) => {
  if (!visible) return null;

  return (
    <div className="flex items-center space-x-2 px-2 py-0.5 rounded bg-white/10 border-x border-white/5 font-mono text-[10px]">
      <span className={metrics.isLowFps ? 'text-red-400' : 'text-green-400'}>
        {metrics.fps} FPS
      </span>
      <span className="text-white/30">|</span>
      <span className={metrics.isHighMemory ? 'text-red-400' : 'text-white/70'}>
        {metrics.memoryMB} MB
      </span>
      <span className="text-white/30">|</span>
      <span className="text-white/70">
        {metrics.cacheUsed}/{metrics.cacheTotal}
      </span>
    </div>
  );
};
