import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrag } from '../hooks/useDrag';

describe('hooks/useDrag', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      body: {
        style: {
          cursor: '',
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return handleMouseDown function', () => {
    const { result } = renderHook(() =>
      useDrag({
        onDrag: vi.fn(),
      })
    );

    expect(result.current.handleMouseDown).toBeDefined();
    expect(typeof result.current.handleMouseDown).toBe('function');
  });

  it('should call onStart when provided', () => {
    const onStart = vi.fn().mockReturnValue('startState');
    const onDrag = vi.fn();

    const { result } = renderHook(() =>
      useDrag({
        onStart,
        onDrag,
      })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(onStart).toHaveBeenCalled();
  });

  it('should set cursor on mouse down', () => {
    const onDrag = vi.fn();

    const { result } = renderHook(() =>
      useDrag({
        onDrag,
        cursor: 'grab',
      })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(document.body.style.cursor).toBe('grab');
  });

  it('should prevent default on mouse down', () => {
    const onDrag = vi.fn();
    const preventDefault = vi.fn();

    const { result } = renderHook(() =>
      useDrag({
        onDrag,
      })
    );

    const mockEvent = {
      preventDefault,
      clientY: 100,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleMouseDown(mockEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
  });
});
