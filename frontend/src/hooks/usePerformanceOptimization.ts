import { useEffect, useRef, useState, useCallback } from 'react';
import { LOG_VIEWER } from '../constants';

export interface PerformanceMetrics {
  fps: number;
  memoryMB: number;
  cacheUsed: number;
  cacheTotal: number;
  isLowFps: boolean;
  isHighMemory: boolean;
}

interface UsePerformanceOptimizationOptions {
  enabled?: boolean;
  debugMode?: boolean;
  onMemoryWarning?: (memoryMB: number) => void;
  onLowFps?: (fps: number) => void;
}

export function usePerformanceOptimization({
  enabled = true,
  debugMode = false,
  onMemoryWarning,
  onLowFps,
}: UsePerformanceOptimizationOptions = {}) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryMB: 0,
    cacheUsed: 0,
    cacheTotal: LOG_VIEWER.MAX_CACHED_LINES,
    isLowFps: false,
    isHighMemory: false,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(performance.now());

  const calculateFps = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    
    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      fpsHistoryRef.current.push(fps);
      
      if (fpsHistoryRef.current.length > 30) {
        fpsHistoryRef.current.shift();
      }
      
      const avgFps = Math.round(
        fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length
      );

      setMetrics(prev => ({
        ...prev,
        fps: avgFps,
        isLowFps: avgFps < 30,
      }));

      if (avgFps < 30) {
        onLowFps?.(avgFps);
      }

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    frameCountRef.current++;
    animationFrameRef.current = requestAnimationFrame(calculateFps);
  }, [onLowFps]);

  const updateMemory = useCallback(() => {
    const memory = (performance as any).memory;
    if (memory) {
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const isHighMemory = usedMB > LOG_VIEWER.MEMORY_WARNING_THRESHOLD_MB;

      setMetrics(prev => ({
        ...prev,
        memoryMB: usedMB,
        isHighMemory,
      }));

      if (isHighMemory) {
        onMemoryWarning?.(usedMB);
      }
    }
  }, [onMemoryWarning]);

  const updateCacheStats = useCallback((used: number, total: number = LOG_VIEWER.MAX_CACHED_LINES) => {
    setMetrics(prev => ({
      ...prev,
      cacheUsed: used,
      cacheTotal: total,
    }));
  }, []);

  useEffect(() => {
    if (!enabled || !debugMode) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(calculateFps);

    const memoryInterval = setInterval(updateMemory, 2000);

    const handleActivity = () => {
      lastActivityRef.current = performance.now();
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(memoryInterval);
      clearInterval(idleInterval);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('resize', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [enabled, debugMode, calculateFps, updateMemory]);

  return {
    metrics,
    updateCacheStats,
    isEnabled: enabled && debugMode,
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
