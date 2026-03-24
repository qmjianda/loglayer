import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

describe('hooks/useCanvasDimensions', () => {
  let mockResizeObserver: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let callbackHolder: {
    current: ((entries: Array<{ contentRect: { width: number; height: number } }>) => void | null;
  };

  beforeEach(() => {
    mockResizeObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    callbackHolder = { current: null };

    vi.stubGlobal('ResizeObserver', vi.fn((callback: (entries: Array<{ contentRect: { width: number; height: number } }>) => void) => {
      callbackHolder.current = callback;
      return mockResizeObserver;
    }));

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should call setViewportWidth and setViewportHeight on initial render', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
    const mockContainerRef = {
      current: {
        clientWidth: 800,
        clientHeight: 600,
      },
    };

    const setViewportWidth = vi.fn();
    const setViewportHeight = vi.fn();

    const { result } = renderHook(() =>
      useCanvasDimensions({
        containerRef: mockContainerRef as React.RefObject<HTMLElement>,
        setViewportWidth,
        setViewportHeight,
      })
    );

    // Wait for useEffect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(setViewportWidth).toHaveBeenCalledWith(800);
    expect(setViewportHeight).toHaveBeenCalledWith(600);
  });

  it('should observe container with ResizeObserver', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(mockResizeObserver.observe).toHaveBeenCalledWith(mockContainerRef.current);
  });

  it('should add window resize listener', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('should not set dimensions when container width is 0', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(setViewportWidth).not.toHaveBeenCalled();
    expect(setViewportHeight).not.toHaveBeenCalled();
  });

  it('should not call setters when containerRef is null', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(setViewportWidth).not.toHaveBeenCalled();
    expect(setViewportHeight).not.toHaveBeenCalled();
    expect(mockResizeObserver.observe).not.toHaveBeenCalled();
  });

  it('should clean up ResizeObserver and event listener on unmount', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    unmount();

    expect(mockResizeObserver.disconnect).toHaveBeenCalled();
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('should handle ResizeObserver callback with valid dimensions', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    if (callbackHolder.current) {
      callbackHolder.current([
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

  it('should not update width when contentRect width is 0', async () => {
    const { useCanvasDimensions } = await import('../../../../../../frontend/src/components/LogViewer/hooks/useCanvasDimensions');
    
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

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    if (callbackHolder.current) {
      callbackHolder.current([
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