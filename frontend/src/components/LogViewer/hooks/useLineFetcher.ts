/**
 * Line Fetcher Hook
 * 
 * Handles lazy loading and caching of log lines with LRU cache eviction.
 * Extracted from LogViewer.tsx lines 258-312 for better separation of concerns.
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { readProcessedLines } from '../../../bridge_client';
import { LOG_VIEWER } from '../../../constants';

/**
 * Parameters for useLineFetcher hook
 */
export interface UseLineFetcherParams {
  /** Current file ID */
  fileId: string | null;
  /** Total number of lines in the file */
  totalLines: number;
  /** Start index for visible range */
  startIndex: number;
  /** End index for visible range */
  endIndex: number;
  /** Trigger to force re-fetch */
  updateTrigger?: number;
  /** Current max line width */
  maxLineWidth: number;
  /** Canvas context for text measurement */
  measureCtxRef: RefObject<CanvasRenderingContext2D | null>;
  /** Character width reference */
  charWidthRef: RefObject<number>;
  /** Gutter width in pixels */
  gutterWidth: number;
  /** Last fetch range reference */
  lastFetchRef: RefObject<{ start: number; end: number }>;
  /** Setter for bridged lines cache */
  setBridgedLines: (value: Map<number, unknown> | ((prev: Map<number, unknown>) => Map<number, unknown>)) => void;
  /** Setter for max line width */
  setMaxLineWidth: (value: number | ((prev: number) => number)) => void;
}

/**
 * Custom hook for fetching and caching log lines
 * 
 * Features:
 * - Lazy loading based on visible range (startIndex/endIndex)
 * - Debounced fetching with FETCH_DEBOUNCE_MS delay
 * - LRU cache eviction when exceeding MAX_CACHED_LINES
 * - Automatic maxLineWidth calculation
 * 
 * @param params - Hook parameters
 */
export function useLineFetcher({
  fileId,
  totalLines,
  startIndex,
  endIndex,
  updateTrigger = 0,
  maxLineWidth,
  measureCtxRef,
  charWidthRef,
  gutterWidth,
  lastFetchRef,
  setBridgedLines,
  setMaxLineWidth,
}: UseLineFetcherParams): void {
  // Clear cache when fileId changes
  useEffect(() => {
    setBridgedLines(new Map());
    lastFetchRef.current = { start: -1, end: -1 };
  }, [fileId, setBridgedLines, lastFetchRef]);

  useEffect(() => {
    lastFetchRef.current = { start: -1, end: -1 };
  }, [updateTrigger]);

  useEffect(() => {
    setBridgedLines(prev => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (Number(key) >= totalLines) {
          next.delete(key);
        }
      }
      return next;
    });
  }, [totalLines]);

  // Fetch lines when visible range changes
  useEffect(() => {
    // Skip if no file or no lines
    if (!fileId || totalLines === 0) return;
    
    // Skip if range hasn't changed
    if (startIndex === lastFetchRef.current.start && endIndex === lastFetchRef.current.end) return;

    // Update last fetch range
    lastFetchRef.current = { start: startIndex, end: endIndex };
    
    let ignore = false;

    const timer = setTimeout(async () => {
      try {
        const count = endIndex - startIndex;
        // Skip invalid ranges
        if (count <= 0 || ignore) return;
        
        // Fetch lines from backend
        const lines = await readProcessedLines(fileId, startIndex, count);
        if (ignore) return;

        // Update bridged lines cache
        setBridgedLines(prev => {
          const next = new Map(prev);
          let newMaxInnerWidth = maxLineWidth;

          lines.forEach((line, idx) => {
            const lineIdx = startIndex + idx;
            next.set(lineIdx, line);

            // Get line content
            const content = typeof line === 'string' ? line : (line as { content: string }).content || '';

            // Measure line width
            const measuredW = measureCtxRef.current
              ? measureCtxRef.current.measureText(content).width
              : content.length * charWidthRef.current;
            
            const lineW = measuredW + gutterWidth + 100;
            if (lineW > newMaxInnerWidth) {
              newMaxInnerWidth = lineW;
            }
          });

          // Update max line width if needed
          if (newMaxInnerWidth > maxLineWidth) {
            setMaxLineWidth(newMaxInnerWidth);
          }

          // LRU cache eviction - remove lines far from visible range
          if (next.size > LOG_VIEWER.MAX_CACHED_LINES) {
            const center = Math.floor((startIndex + endIndex) / 2);
            for (const key of next.keys()) {
              if (Math.abs(Number(key) - center) > LOG_VIEWER.CACHE_CLEAR_DISTANCE) {
                next.delete(key);
              }
            }
          }

          return next;
        });
      } catch (e) {
        console.error('Failed to fetch lines:', e);
      }
    }, LOG_VIEWER.FETCH_DEBOUNCE_MS);

    // Cleanup function
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [
    startIndex,
    endIndex,
    fileId,
    totalLines,
    updateTrigger,
    maxLineWidth,
    measureCtxRef,
    charWidthRef,
    gutterWidth,
    lastFetchRef,
    setBridgedLines,
    setMaxLineWidth,
  ]);
}

export default useLineFetcher;