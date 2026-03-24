import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollLogic } from '@/components/LogViewer/hooks/useScrollLogic';

describe('useScrollLogic', () => {
  const createMockRefs = () => ({
    scrollVelocityRef: { current: 0 },
    scrollDirectionRef: { current: null },
    lastScrollTimeRef: { current: 0 },
    lastScrollTopRef: { current: 0 },
  });

  const createMockContainer = () => {
    const container = {
      scrollTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    return container as unknown as HTMLElement & { scrollTop: number };
  };

  const defaultProps = {
    scrollTop: 0,
    viewportHeight: 600,
    viewportWidth: 800,
    totalLines: 10000,
    lineHeight: 20,
    buffer: 800,
    useScrollScaling: false,
    virtualTotalHeight: 200000,
    realTotalHeight: 200000,
    containerRef: { current: null },
    ...createMockRefs(),
  };

  describe('scroll calculations', () => {
    it('calculates maxPhysicalScroll correctly', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          viewportHeight: 600,
          virtualTotalHeight: 200000,
        })
      );

      expect(result.current.computed.maxPhysicalScroll).toBe(199400);
    });

    it('calculates maxLogicalScroll correctly', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          viewportHeight: 600,
          realTotalHeight: 200000,
        })
      );

      expect(result.current.computed.maxLogicalScroll).toBe(199400);
    });

    it('calculates effectiveScrollTop without scaling', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          scrollTop: 1000,
          useScrollScaling: false,
        })
      );

      expect(result.current.computed.effectiveScrollTop).toBe(1000);
    });

    it('calculates effectiveScrollTop with scaling', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          scrollTop: 500,
          useScrollScaling: true,
          virtualTotalHeight: 200000,
          realTotalHeight: 100000,
        })
      );

      expect(result.current.computed.effectiveScrollTop).toBeCloseTo(249.25, 1);
    });

    it('calculates startIndex correctly', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          scrollTop: 1000,
          lineHeight: 20,
          buffer: 800,
        })
      );

      expect(result.current.computed.startIndex).toBe(0);
    });

    it('calculates endIndex correctly', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          scrollTop: 0,
          viewportHeight: 600,
          lineHeight: 20,
          buffer: 800,
          totalLines: 10000,
        })
      );

      expect(result.current.computed.endIndex).toBe(830);
    });

    it('clamps endIndex to totalLines', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          scrollTop: 0,
          viewportHeight: 600,
          lineHeight: 20,
          buffer: 800,
          totalLines: 500,
        })
      );

      expect(result.current.computed.endIndex).toBe(500);
    });
  });

  describe('wheel event handling', () => {
    let mockContainer: ReturnType<typeof createMockContainer>;

    beforeEach(() => {
      mockContainer = createMockContainer();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('registers wheel event listener', () => {
      const { result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          containerRef: { current: mockContainer },
        })
      );

      expect(mockContainer.addEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        { passive: false }
      );
    });

    it('cleans up wheel event listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          containerRef: { current: mockContainer },
        })
      );

      unmount();

      expect(mockContainer.removeEventListener).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function)
      );
    });

    it('scrolls by logicalDelta for trackpad (small delta)', () => {
      const { result: _result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          containerRef: { current: mockContainer },
          lineHeight: 20,
        })
      );

      const wheelHandler = mockContainer.addEventListener.mock.calls.find(
        (call: Parameters<typeof mockContainer.addEventListener>) => call[0] === 'wheel'
      )?.[1] as (e: WheelEvent) => void;

      const mockEvent = {
        deltaY: 30,
        deltaMode: 0,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      wheelHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockContainer.scrollTop).toBe(30);
    });

    it('scrolls by line-based delta for mouse wheel (large delta)', () => {
      const { result: _result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          containerRef: { current: mockContainer },
          lineHeight: 20,
        })
      );

      const wheelHandler = mockContainer.addEventListener.mock.calls.find(
        (call: Parameters<typeof mockContainer.addEventListener>) => call[0] === 'wheel'
      )?.[1] as (e: WheelEvent) => void;

      const mockEvent = {
        deltaY: 100,
        deltaMode: 1,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      wheelHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockContainer.scrollTop).toBe(60);
    });
  });

  describe('scroll scaling', () => {
    it('applies scroll scaling when enabled', () => {
      const mockContainer = createMockContainer();

      const { result: _result } = renderHook(() =>
        useScrollLogic({
          ...defaultProps,
          containerRef: { current: mockContainer },
          useScrollScaling: true,
          virtualTotalHeight: 200000,
          realTotalHeight: 100000,
          lineHeight: 20,
        })
      );

      const wheelHandler = mockContainer.addEventListener.mock.calls.find(
        (call: Parameters<typeof mockContainer.addEventListener>) => call[0] === 'wheel'
      )?.[1] as (e: WheelEvent) => void;

      const mockEvent = {
        deltaY: 100,
        deltaMode: 0,
        preventDefault: vi.fn(),
      } as unknown as WheelEvent;

      wheelHandler(mockEvent);

      expect(mockContainer.scrollTop).toBeCloseTo(120.4, 0);
    });
  });
});