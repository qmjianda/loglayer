import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLineFetcher } from './useLineFetcher';

describe('hooks/useLineFetcher', () => {
  let mockSetBridgedLines: (value: Map<number, unknown> | ((prev: Map<number, unknown>) => Map<number, unknown>)) => void;
  let mockSetMaxLineWidth: (value: number | ((prev: number) => number)) => void;
  let mockLastFetchRef: { current: { start: number; end: number } };
  let mockMeasureCtxRef: { current: CanvasRenderingContext2D | null };
  let mockCharWidthRef: { current: number };
  let bridgedLinesCallCount = 0;

  beforeEach(() => {
    bridgedLinesCallCount = 0;
    mockSetBridgedLines = vi.fn(() => {
      bridgedLinesCallCount++;
    });
    mockSetMaxLineWidth = vi.fn();
    mockLastFetchRef = { current: { start: -1, end: -1 } };
    mockMeasureCtxRef = { current: null };
    mockCharWidthRef = { current: 8 };

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clear cache when fileId changes', () => {
    const { rerender } = renderHook(
      ({ fileId }) =>
        useLineFetcher({
          fileId,
          totalLines: 1000,
          startIndex: 0,
          endIndex: 100,
          maxLineWidth: 800,
          measureCtxRef: mockMeasureCtxRef,
          charWidthRef: mockCharWidthRef,
          gutterWidth: 80,
          lastFetchRef: mockLastFetchRef,
          setBridgedLines: mockSetBridgedLines,
          setMaxLineWidth: mockSetMaxLineWidth,
        }),
      { initialProps: { fileId: 'file1' } }
    );

    expect(bridgedLinesCallCount).toBe(1);

    rerender({ fileId: 'file2' });

    expect(bridgedLinesCallCount).toBe(2);
  });

  it('should skip fetch when fileId is null', () => {
    renderHook(() =>
      useLineFetcher({
        fileId: null,
        totalLines: 1000,
        startIndex: 0,
        endIndex: 100,
        maxLineWidth: 800,
        measureCtxRef: mockMeasureCtxRef,
        charWidthRef: mockCharWidthRef,
        gutterWidth: 80,
        lastFetchRef: mockLastFetchRef,
        setBridgedLines: mockSetBridgedLines,
        setMaxLineWidth: mockSetMaxLineWidth,
      })
    );

    expect(bridgedLinesCallCount).toBe(0);
  });

  it('should skip fetch when totalLines is 0', () => {
    renderHook(() =>
      useLineFetcher({
        fileId: 'file1',
        totalLines: 0,
        startIndex: 0,
        endIndex: 100,
        maxLineWidth: 800,
        measureCtxRef: mockMeasureCtxRef,
        charWidthRef: mockCharWidthRef,
        gutterWidth: 80,
        lastFetchRef: mockLastFetchRef,
        setBridgedLines: mockSetBridgedLines,
        setMaxLineWidth: mockSetMaxLineWidth,
      })
    );

    expect(bridgedLinesCallCount).toBe(0);
  });

  it('should skip fetch when range has not changed', () => {
    mockLastFetchRef.current = { start: 0, end: 100 };

    renderHook(() =>
      useLineFetcher({
        fileId: 'file1',
        totalLines: 1000,
        startIndex: 0,
        endIndex: 100,
        maxLineWidth: 800,
        measureCtxRef: mockMeasureCtxRef,
        charWidthRef: mockCharWidthRef,
        gutterWidth: 80,
        lastFetchRef: mockLastFetchRef,
        setBridgedLines: mockSetBridgedLines,
        setMaxLineWidth: mockSetMaxLineWidth,
      })
    );

    expect(bridgedLinesCallCount).toBe(0);
  });

  it('should update lastFetchRef when range changes', () => {
    mockLastFetchRef.current = { start: -1, end: -1 };

    renderHook(() =>
      useLineFetcher({
        fileId: 'file1',
        totalLines: 1000,
        startIndex: 0,
        endIndex: 100,
        maxLineWidth: 800,
        measureCtxRef: mockMeasureCtxRef,
        charWidthRef: mockCharWidthRef,
        gutterWidth: 80,
        lastFetchRef: mockLastFetchRef,
        setBridgedLines: mockSetBridgedLines,
        setMaxLineWidth: mockSetMaxLineWidth,
      })
    );

    expect(mockLastFetchRef.current).toEqual({ start: 0, end: 100 });
  });
});