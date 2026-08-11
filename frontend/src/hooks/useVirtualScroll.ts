/**
 * useVirtualScroll - Virtual scroll performance hook
 *
 * Combines scroll prediction and performance optimization for smooth virtual scrolling.
 * Merged from useScrollPrediction and usePerformanceOptimization.
 */

import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { LOG_VIEWER } from '../constants';

interface ScrollState {
  position: number;
  timestamp: number;
  velocity: number;
  direction: 'up' | 'down' | 'idle';
}

export interface PerformanceMetrics {
  fps: number;
  memoryMB: number;
  cacheUsed: number;
  cacheTotal: number;
  isLowFps: boolean;
  isHighMemory: boolean;
}

export interface UseVirtualScrollOptions {
  lineHeight?: number;
  bufferNormal?: number;
  bufferLarge?: number;
  velocityThreshold?: number;
  enabled?: boolean;
  debugMode?: boolean;
  onMemoryWarning?: (memoryMB: number) => void;
  onLowFps?: (fps: number) => void;
}

export interface UseVirtualScrollReturn {
  // Scroll prediction
  updateScrollState: (scrollTop: number, viewportHeight: number) => void;
  getRecommendedBuffer: (
    scrollTop: number,
    viewportHeight: number,
    totalLines: number,
  ) => { top: number; bottom: number };
  predictNextVisibleRange: (
    currentStart: number,
    currentEnd: number,
    viewportHeight: number,
    totalLines: number,
  ) => { start: number; end: number } | null;
  getMomentum: () => number;
  isScrollingFast: () => boolean;
  scrollState: ScrollState;

  // Performance metrics
  metrics: PerformanceMetrics;
  updateCacheStats: (used: number, total?: number) => void;
  isEnabled: boolean;
}

export function useVirtualScroll({
  lineHeight = LOG_VIEWER.LINE_HEIGHT,
  bufferNormal = LOG_VIEWER.BUFFER_NORMAL,
  bufferLarge = LOG_VIEWER.BUFFER_LARGE,
  velocityThreshold = 0.5,
  enabled = true,
  debugMode = false,
  onMemoryWarning,
  onLowFps,
}: UseVirtualScrollOptions = {}): UseVirtualScrollReturn {
  // === Scroll Prediction State ===
  const scrollState = useRef<ScrollState>({
    position: 0,
    timestamp: 0,
    velocity: 0,
    direction: 'idle',
  });

  const lastPositions = useRef<{ pos: number; time: number }[]>([]);

  // === Performance Metrics State ===
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

  // === Scroll Prediction Methods ===
  // [二期候选] 预测/降质/自适应 buffer，本期不接线
  const updateScrollState = useCallback((scrollTop: number, viewportHeight: number) => {
    const now = performance.now();
    const state = scrollState.current;

    const newVelocity = Math.abs(scrollTop - state.position) / Math.max(1, now - state.timestamp);
    const newDirection =
      scrollTop > state.position ? 'down' : scrollTop < state.position ? 'up' : state.direction;

    state.position = scrollTop;
    state.timestamp = now;
    state.velocity = newVelocity;
    state.direction = newDirection;

    lastPositions.current.push({ pos: scrollTop, time: now });
    if (lastPositions.current.length > 10) {
      lastPositions.current.shift();
    }
  }, []);

  // [二期候选] 预测/降质/自适应 buffer，本期不接线
  const getRecommendedBuffer = useCallback(
    (
      _scrollTop: number,
      viewportHeight: number,
      totalLines: number,
    ): { top: number; bottom: number } => {
      const velocity = scrollState.current.velocity;
      const direction = scrollState.current.direction;

      const baseTop = bufferNormal;
      const baseBottom = bufferNormal;

      if (velocity > velocityThreshold * 10) {
        const boost = Math.min(bufferLarge - bufferNormal, Math.floor(velocity * 50));
        if (direction === 'down') {
          return { top: baseTop, bottom: baseBottom + boost };
        } else if (direction === 'up') {
          return { top: baseTop + boost, bottom: baseBottom };
        }
      } else if (velocity > velocityThreshold) {
        return { top: bufferNormal + 50, bottom: bufferNormal + 50 };
      }

      return { top: baseTop, bottom: baseBottom };
    },
    [bufferNormal, bufferLarge, velocityThreshold],
  );

  // [二期候选] 预测/降质/自适应 buffer，本期不接线
  const predictNextVisibleRange = useCallback(
    (
      currentStart: number,
      currentEnd: number,
      viewportHeight: number,
      totalLines: number,
    ): { start: number; end: number } | null => {
      const velocity = scrollState.current.velocity;
      const direction = scrollState.current.direction;

      if (velocity < velocityThreshold * 5 || direction === 'idle') {
        return null;
      }

      const linesPerMs = velocity / lineHeight;
      const predictedScrollMs = 500;
      const predictedLines = Math.floor(linesPerMs * predictedScrollMs);

      if (predictedLines < 10) return null;

      let predictedStart = currentStart;
      let predictedEnd = currentEnd;

      if (direction === 'down') {
        predictedEnd = Math.min(totalLines, currentEnd + predictedLines);
      } else if (direction === 'up') {
        predictedStart = Math.max(0, currentStart - predictedLines);
      }

      return { start: predictedStart, end: predictedEnd };
    },
    [lineHeight, velocityThreshold],
  );

  // [二期候选] 预测/降质/自适应 buffer，本期不接线
  const getMomentum = useCallback((): number => {
    const positions = lastPositions.current;
    if (positions.length < 2) return 0;

    let totalVelocity = 0;
    for (let i = 1; i < positions.length; i++) {
      const deltaPos = positions[i].pos - positions[i - 1].pos;
      const deltaTime = positions[i].time - positions[i - 1].time;
      if (deltaTime > 0) {
        totalVelocity += deltaPos / deltaTime;
      }
    }
    return totalVelocity / (positions.length - 1);
  }, []);

  // [二期候选] 预测/降质/自适应 buffer，本期不接线
  const isScrollingFast = useCallback((): boolean => {
    return scrollState.current.velocity > velocityThreshold * 3;
  }, [velocityThreshold]);

  // === Performance Optimization Methods ===
  const calculateFps = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;

    if (delta >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      fpsHistoryRef.current.push(fps);

      if (fpsHistoryRef.current.length > 30) {
        fpsHistoryRef.current.shift();
      }

      const avgFps = computeAverageFps(fpsHistoryRef.current);
      const low = isLowFps(avgFps);

      setMetrics((prev) => ({
        ...prev,
        fps: avgFps,
        isLowFps: low,
      }));

      if (low) {
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

      setMetrics((prev) => ({
        ...prev,
        memoryMB: usedMB,
        isHighMemory,
      }));

      if (isHighMemory) {
        onMemoryWarning?.(usedMB);
      }
    }
  }, [onMemoryWarning]);

  const updateCacheStats = useCallback(
    (used: number, total: number = LOG_VIEWER.MAX_CACHED_LINES) => {
      setMetrics((prev) => ({
        ...prev,
        cacheUsed: used,
        cacheTotal: total,
      }));
    },
    [],
  );

  // === Effects ===
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

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(memoryInterval);
    };
  }, [enabled, debugMode, calculateFps, updateMemory]);

  return {
    updateScrollState,
    getRecommendedBuffer,
    predictNextVisibleRange,
    getMomentum,
    isScrollingFast,
    scrollState: scrollState.current,
    metrics,
    updateCacheStats,
    isEnabled: enabled && debugMode,
  };
}

// Utility functions
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

/**
 * FPS 采集纯函数：计算最近时段的平均帧率（四舍五入）。空样本返回 0。
 */
export function computeAverageFps(fpsHistory: number[]): number {
  if (fpsHistory.length === 0) return 0;
  const sum = fpsHistory.reduce((acc, fps) => acc + fps, 0);
  return Math.round(sum / fpsHistory.length);
}

/**
 * 低帧率标记：平均 FPS 低于阈值（30）视为低帧率。
 */
export function isLowFps(avgFps: number): boolean {
  return avgFps < 30;
}
