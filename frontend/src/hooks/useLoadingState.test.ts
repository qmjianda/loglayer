import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState } from '../hooks/useLoadingState';

describe('hooks/useLoadingState', () => {
  it('should return initial state with empty Map', () => {
    const { result } = renderHook(() => useLoadingState());
    expect(result.current.states.size).toBe(0);
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('should start loading', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('test');
    });

    expect(result.current.states.size).toBe(1);
    expect(result.current.states.get('test')?.isLoading).toBe(true);
    expect(result.current.isAnyLoading).toBe(true);
  });

  it('should start loading with message', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('test', 'Loading...');
    });

    expect(result.current.states.get('test')?.message).toBe('Loading...');
  });

  it('should update progress', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('test');
    });

    act(() => {
      result.current.updateProgress('test', 50);
    });

    expect(result.current.states.get('test')?.progress).toBe(50);
  });

  it('should stop loading', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('test');
    });

    act(() => {
      result.current.stopLoading('test');
    });

    expect(result.current.states.get('test')?.isLoading).toBe(false);
    expect(result.current.states.get('test')?.progress).toBe(100);
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('should set error', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setError('test', 'Something went wrong');
    });

    expect(result.current.states.get('test')?.error).toBe('Something went wrong');
    expect(result.current.states.get('test')?.isLoading).toBe(false);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setError('test', 'Error');
    });

    act(() => {
      result.current.clearError('test');
    });

    expect(result.current.states.get('test')?.error).toBeUndefined();
  });

  it('should get state', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('test', 'Loading');
    });

    const state = result.current.getState('test');
    expect(state?.isLoading).toBe(true);
    expect(state?.message).toBe('Loading');
  });

  it('should return undefined for non-existent key', () => {
    const { result } = renderHook(() => useLoadingState());
    expect(result.current.getState('non-existent')).toBeUndefined();
  });

  it('should handle multiple loading keys', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.startLoading('test1');
      result.current.startLoading('test2');
    });

    expect(result.current.states.size).toBe(2);
    expect(result.current.isAnyLoading).toBe(true);

    act(() => {
      result.current.stopLoading('test1');
    });

    expect(result.current.isAnyLoading).toBe(true);

    act(() => {
      result.current.stopLoading('test2');
    });

    expect(result.current.isAnyLoading).toBe(false);
  });
});
