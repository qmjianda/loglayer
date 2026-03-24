/**
 * Scroll Logic Hook
 * 
 * Extracts scroll calculation and wheel event handling from LogViewer.tsx
 * for better separation of concerns and testability.
 * 
 * Original code: LogViewer.tsx lines 249-256, 408-432
 */

import { useEffect, useMemo, useRef, useCallback } from 'react';

/**
 * Constants for scroll behavior
 */
const LOG_VIEWER_CONSTANTS = {
  WHEEL_LINES_PER_TICK: 3,
  LINE_HEIGHT: 20,
  BUFFER_NORMAL: 800,
  BUFFER_LARGE: 1500,
};

/**
 * State interface for scroll logic calculations
 */
export interface ScrollLogicState {
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
  totalLines: number;
  lineHeight: number;
  buffer: number;
  useScrollScaling: boolean;
  virtualTotalHeight: number;
  realTotalHeight: number;
}

/**
 * Computed scroll values
 */
export interface ScrollLogicComputed {
  maxPhysicalScroll: number;
  maxLogicalScroll: number;
  effectiveScrollTop: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Refs for scroll velocity tracking
 */
export interface ScrollLogicRefs {
  scrollVelocityRef: React.MutableRefObject<number>;
  scrollDirectionRef: React.MutableRefObject<'up' | 'down' | null>;
  lastScrollTimeRef: React.MutableRefObject<number>;
  lastScrollTopRef: React.MutableRefObject<number>;
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Props for useScrollLogic hook
 */
export interface UseScrollLogicProps {
  scrollTop: number;
  viewportHeight: number;
  viewportWidth: number;
  totalLines: number;
  lineHeight?: number;
  buffer?: number;
  useScrollScaling: boolean;
  virtualTotalHeight: number;
  realTotalHeight: number;
  containerRef: React.RefObject<HTMLElement | null>;
  scrollVelocityRef: React.MutableRefObject<number>;
  scrollDirectionRef: React.MutableRefObject<'up' | 'down' | null>;
  lastScrollTimeRef: React.MutableRefObject<number>;
  lastScrollTopRef: React.MutableRefObject<number>;
}

/**
 * Custom hook for scroll logic calculations
 * 
 * Handles:
 * - Effective scroll top calculation (with scroll scaling)
 * - Visible line range calculation (startIndex/endIndex)
 * - Wheel event handling (trackpad vs mouse wheel)
 * - Scroll velocity and direction tracking
 * 
 * @param props - Scroll logic configuration
 * @returns Computed values and scroll actions
 */
export function useScrollLogic({
  scrollTop,
  viewportHeight,
  viewportWidth,
  totalLines,
  lineHeight = LOG_VIEWER_CONSTANTS.LINE_HEIGHT,
  buffer = LOG_VIEWER_CONSTANTS.BUFFER_NORMAL,
  useScrollScaling,
  virtualTotalHeight,
  realTotalHeight,
  containerRef,
  scrollVelocityRef,
  scrollDirectionRef,
  lastScrollTimeRef,
  lastScrollTopRef,
}: UseScrollLogicProps) {
  // ========== Scroll Calculations ==========
  
  /**
   * Calculate max physical scroll position
   */
  const maxPhysicalScroll = useMemo(
    () => Math.max(0, virtualTotalHeight - viewportHeight),
    [virtualTotalHeight, viewportHeight]
  );

  /**
   * Calculate max logical scroll position
   */
  const maxLogicalScroll = useMemo(
    () => Math.max(0, realTotalHeight - viewportHeight),
    [realTotalHeight, viewportHeight]
  );

  /**
   * Calculate effective scroll top (applies scroll scaling when enabled)
   * 
   * When useScrollScaling is true, maps scroll position from physical
   * (canvas-based) to logical (line-based) coordinate space.
   */
  const effectiveScrollTop = useMemo(() => {
    if (useScrollScaling && maxPhysicalScroll > 0) {
      return (scrollTop / maxPhysicalScroll) * maxLogicalScroll;
    }
    return scrollTop;
  }, [scrollTop, maxPhysicalScroll, maxLogicalScroll, useScrollScaling]);

  /**
   * Calculate start index of visible lines
   * 
   * Includes buffer for smooth scrolling - renders extra lines
   * above the visible viewport.
   */
  const startIndex = useMemo(
    () => Math.max(0, Math.floor(effectiveScrollTop / lineHeight) - buffer),
    [effectiveScrollTop, lineHeight, buffer]
  );

  /**
   * Calculate end index of visible lines
   * 
   * Includes buffer for smooth scrolling - renders extra lines
   * below the visible viewport.
   */
  const endIndex = useMemo(
    () => Math.min(totalLines, Math.ceil((effectiveScrollTop + viewportHeight) / lineHeight) + buffer),
    [effectiveScrollTop, viewportHeight, lineHeight, buffer, totalLines]
  );

  // ========== Wheel Event Handler ==========
  
  /**
   * Update scroll velocity and direction tracking
   */
  const updateScrollVelocity = useCallback((newScrollTop: number) => {
    const now = performance.now();
    const timeDelta = now - lastScrollTimeRef.current;
    
    if (timeDelta > 0) {
      const scrollDelta = newScrollTop - lastScrollTopRef.current;
      scrollVelocityRef.current = Math.abs(scrollDelta) / timeDelta;
      scrollDirectionRef.current = scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : scrollDirectionRef.current;
    }
    
    lastScrollTimeRef.current = now;
    lastScrollTopRef.current = newScrollTop;
  }, [lastScrollTimeRef, lastScrollTopRef, scrollVelocityRef, scrollDirectionRef]);

  /**
   * Custom wheel handler with trackpad/mouse wheel detection
   * 
   * - Trackpad: smooth pixel-level scrolling (deltaMode === 0, small deltas)
   * - Mouse wheel: discrete line-based scrolling
   * 
   * Original: LogViewer.tsx lines 408-432
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Detect trackpad vs mouse wheel
      // Trackpad typically sends smaller, pixel-based deltas
      const isTrackpad = Math.abs(e.deltaY) < 50 && e.deltaMode === 0;

      let logicalDelta: number;
      if (isTrackpad) {
        // Smooth pixel-level scrolling for trackpad
        logicalDelta = e.deltaY;
      } else {
        // Discrete line-based scrolling for mouse wheel
        const linesToScroll = LOG_VIEWER_CONSTANTS.WHEEL_LINES_PER_TICK;
        logicalDelta = Math.sign(e.deltaY) * linesToScroll * lineHeight;
      }

      // Apply scroll scaling if enabled
      const physicalDelta = useScrollScaling && maxLogicalScroll > 0
        ? (logicalDelta / maxLogicalScroll) * maxPhysicalScroll
        : logicalDelta;

      // Update scroll position
      container.scrollTop += physicalDelta;

      // Update velocity tracking
      updateScrollVelocity(container.scrollTop);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [
    containerRef,
    useScrollScaling,
    maxLogicalScroll,
    maxPhysicalScroll,
    lineHeight,
    updateScrollVelocity,
  ]);

  // ========== Return Computed Values ==========
  const computed = useMemo<ScrollLogicComputed>(
    () => ({
      maxPhysicalScroll,
      maxLogicalScroll,
      effectiveScrollTop,
      startIndex,
      endIndex,
    }),
    [maxPhysicalScroll, maxLogicalScroll, effectiveScrollTop, startIndex, endIndex]
  );

  return {
    computed,
    updateScrollVelocity,
  };
}

export default useScrollLogic;