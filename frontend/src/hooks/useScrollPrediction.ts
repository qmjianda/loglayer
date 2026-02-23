import { useRef, useCallback } from 'react';
import { LOG_VIEWER } from '../constants';

interface ScrollState {
  position: number;
  timestamp: number;
  velocity: number;
  direction: 'up' | 'down' | 'idle';
}

interface UseScrollPredictionOptions {
  lineHeight?: number;
  bufferNormal?: number;
  bufferLarge?: number;
  velocityThreshold?: number;
}

export function useScrollPrediction({
  lineHeight = LOG_VIEWER.LINE_HEIGHT,
  bufferNormal = LOG_VIEWER.BUFFER_NORMAL,
  bufferLarge = LOG_VIEWER.BUFFER_LARGE,
  velocityThreshold = 0.5,
}: UseScrollPredictionOptions = {}) {
  const scrollState = useRef<ScrollState>({
    position: 0,
    timestamp: 0,
    velocity: 0,
    direction: 'idle',
  });

  const lastPositions = useRef<{ pos: number; time: number }[]>([]);

  const updateScrollState = useCallback((scrollTop: number, viewportHeight: number) => {
    const now = performance.now();
    const state = scrollState.current;

    const newVelocity = Math.abs(scrollTop - state.position) / Math.max(1, now - state.timestamp);
    const newDirection = scrollTop > state.position ? 'down' : scrollTop < state.position ? 'up' : state.direction;

    state.position = scrollTop;
    state.timestamp = now;
    state.velocity = newVelocity;
    state.direction = newDirection;

    lastPositions.current.push({ pos: scrollTop, time: now });
    if (lastPositions.current.length > 10) {
      lastPositions.current.shift();
    }
  }, []);

  const getRecommendedBuffer = useCallback((
    _scrollTop: number,
    viewportHeight: number,
    totalLines: number
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
  }, [bufferNormal, bufferLarge, velocityThreshold]);

  const predictNextVisibleRange = useCallback((
    currentStart: number,
    currentEnd: number,
    viewportHeight: number,
    totalLines: number
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
  }, [lineHeight, velocityThreshold]);

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

  const isScrollingFast = useCallback((): boolean => {
    return scrollState.current.velocity > velocityThreshold * 3;
  }, [velocityThreshold]);

  return {
    updateScrollState,
    getRecommendedBuffer,
    predictNextVisibleRange,
    getMomentum,
    isScrollingFast,
    scrollState: scrollState.current,
  };
}
