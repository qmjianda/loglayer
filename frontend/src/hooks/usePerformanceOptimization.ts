import { useEffect, useRef, useCallback } from 'react';
import { LOG_VIEWER } from '../constants';

interface UsePerformanceOptimizationOptions {
  enabled?: boolean;
  onMemoryWarning?: (memoryMB: number) => void;
  onLowFps?: (fps: number) => void;
}

export function usePerformanceOptimization({
  enabled = true,
  onMemoryWarning,
  onLowFps,
}: UsePerformanceOptimizationOptions = {}) {
  const idleTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);

  const handleMemoryWarning = useCallback(() => {
    const memory = (performance as any).memory;
    if (memory) {
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      if (usedMB > LOG_VIEWER.MEMORY_WARNING_THRESHOLD_MB) {
        onMemoryWarning?.(usedMB);
      }
    }
  }, [onMemoryWarning]);

  const handleFpsWarning = useCallback((fps: number) => {
    fpsHistoryRef.current.push(fps);
    if (fpsHistoryRef.current.length > 60) {
      fpsHistoryRef.current.shift();
    }

    const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
    if (avgFps < 30) {
      onLowFps?.(avgFps);
    }
  }, [onLowFps]);

  useEffect(() => {
    if (!enabled) return;

    const handleActivity = () => {
      lastActivityRef.current = performance.now();
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const checkIdle = () => {
      const idleTime = performance.now() - lastActivityRef.current;
      if (idleTime > LOG_VIEWER.IDLE_THRESHOLD_MS && LOG_VIEWER.CACHE_PRUNE_ON_IDLE) {
      }
    };

    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('resize', handleActivity);
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });

    const idleInterval = setInterval(checkIdle, 1000);

    return () => {
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('resize', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      clearInterval(idleInterval);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [enabled]);

  return {
    handleMemoryWarning,
    handleFpsWarning,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function estimateMemoryUsage(lineCount: number, avgLineLength: number = 100): string {
  const bytesPerLine = avgLineLength * 2;
  const totalBytes = lineCount * bytesPerLine;
  return formatBytes(totalBytes);
}