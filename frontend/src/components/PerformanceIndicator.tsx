import React from 'react';
import { PerformanceMetrics } from '../hooks/useVirtualScroll';

interface PerformanceIndicatorProps {
  metrics: PerformanceMetrics;
  visible: boolean;
}

const formatRate = (mbps: number): string => {
  if (mbps < 0.01) return '0 MB/s';
  if (mbps < 1) return `${(mbps * 1000).toFixed(0)} KB/s`;
  return `${mbps.toFixed(1)} MB/s`;
};

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
      {metrics.diskReadRateMBps !== undefined && (
        <>
          <span className="text-white/30">|</span>
          <span className="text-blue-300" title={`Disk Read: ${metrics.diskReadMB?.toFixed(1) || 0} MB total`}>
            ↓{formatRate(metrics.diskReadRateMBps)}
          </span>
        </>
      )}
      {metrics.diskWriteRateMBps !== undefined && (
        <>
          <span className="text-blue-300" title={`Disk Write: ${metrics.diskWriteMB?.toFixed(1) || 0} MB total`}>
            ↑{formatRate(metrics.diskWriteRateMBps)}
          </span>
        </>
      )}
    </div>
  );
};
