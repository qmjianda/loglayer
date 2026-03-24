import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useCanvasDimensions } from './useCanvasDimensions';

describe('hooks/useCanvasDimensions', () => {
  let mockResizeObserver: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    callback: ((entries: Array<{ contentRect: { width: number; height: number } }>) => void) | null;
  };

  beforeEach(() => {
    mockResizeObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      callback: null,
    };

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    vi.stubGlobal('ResizeObserver', vi.fn().mockImplementation((callback: (entries: Array<{ contentRect: { width: number; height: number } }>) => void) => {
      mockResizeObserver.callback = callback;
      return mockResizeObserver;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should call setViewportWidth and setViewportHeight on initial render', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    expect(setViewportWidth).toHaveBeenCalledWith(800);
    expect(setViewportHeight).toHaveBeenCalledWith(600);
  });

  it('should observe container with ResizeObserver', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    expect(mockResizeObserver.observe).toHaveBeenCalledWith(mockContainerRef.current);
  });

  it('should add window resize listener', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('should not set dimensions when container width is 0', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 0,
        clientHeight: 0,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    expect(setViewportWidth).not.toHaveBeenCalled();
    expect(setViewportHeight).not.toHaveBeenCalled();
  });

  it('should not call setters when containerRef is null', () => {
    const mockContainerRef = { current: null };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as unknown as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    expect(setViewportWidth).not.toHaveBeenCalled();
    expect(setViewportHeight).not.toHaveBeenCalled();
    expect(mockResizeObserver.observe).not.toHaveBeenCalled();
  });

  it('should clean up ResizeObserver and event listener on unmount', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    const { unmount } = renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    unmount();

    expect(mockResizeObserver.disconnect).toHaveBeenCalled();
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('should handle ResizeObserver callback with valid dimensions', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    if (mockResizeObserver.callback) {
      mockResizeObserver.callback([
        {
          contentRect: {
            width: 1024,
            height: 768,
          },
        },
      ]);
    }

    expect(setViewportWidth).toHaveBeenCalledWith(1024);
    expect(setViewportHeight).toHaveBeenCalledWith(768);
  });

  it('should not update width when contentRect width is 0', () => {
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    if (mockResizeObserver.callback) {
      mockResizeObserver.callback([
        {
          contentRect: {
            width: 0,
            height: 768,
          },
        },
      ]);
    }

    expect(setViewportWidth).not.toHaveBeenCalledWith(0);
    expect(setViewportHeight).toHaveBeenCalledWith(768);
  });
});