/**
 * Canvas Dimensions Hook
 * 
 * Handles container resize detection and viewport dimension updates
 * using ResizeObserver and window resize events.
 * 
 * Migrated from LogViewer.tsx lines 212-247
 */

import { useEffect, useRef, RefObject } from 'react';

/**
 * Canvas dimensions state and actions
 */
export interface CanvasDimensions {
  /** Current viewport width */
  viewportWidth: number;
  /** Current viewport height */
  viewportHeight: number;
  /** Whether initial dimensions have been set */
  initialDimensionsSet: boolean;
}

/**
 * Props for useCanvasDimensions hook
 */
export interface UseCanvasDimensionsProps {
  /** Ref to the container element */
  containerRef: RefObject<HTMLElement | null>;
  /** Callback to set viewport width in parent */
  setViewportWidth: (value: number | ((prev: number) => number)) => void;
  /** Callback to set viewport height in parent */
  setViewportHeight: (value: number | ((prev: number) => number)) => void;
}

/**
 * Custom hook for canvas/container dimension tracking
 * 
 * Uses ResizeObserver to observe container size changes and updates
 * viewport dimensions accordingly. Also listens to window resize events.
 * 
 * @param props - Hook props including container ref and dimension setters
 * @returns Canvas dimensions state
 */
export function useCanvasDimensions({
  containerRef,
  setViewportWidth,
  setViewportHeight,
}: UseCanvasDimensionsProps): CanvasDimensions {
  const initialDimensionsSet = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    /**
     * Updates dimensions from container's clientWidth/clientHeight
     */
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setViewportWidth(clientWidth);
          setViewportHeight(clientHeight);
          initialDimensionsSet.current = true;
        }
      }
    };

    // Initial dimension update
    updateDimensions();

    // Set up ResizeObserver for ongoing dimension changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setViewportWidth(entry.contentRect.width);
        }
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    // Listen to window resize for comprehensive coverage
    window.addEventListener('resize', updateDimensions);

    // Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [containerRef, setViewportWidth, setViewportHeight]);

  return {
    viewportWidth: 0, // These will be set by the parent via callbacks
    viewportHeight: 0,
    initialDimensionsSet: initialDimensionsSet.current,
  };
}

export default useCanvasDimensions;