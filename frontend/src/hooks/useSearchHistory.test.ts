import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '../hooks/useSearchHistory';

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('hooks/useSearchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should return empty history initially', () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.searchHistory).toEqual([]);
  });

  it('should load history from localStorage', () => {
    const history = [
      { query: 'error', timestamp: 123, config: { regex: false, caseSensitive: false } },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(history));

    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.searchHistory).toEqual(history);
  });

  it('should add item to history', async () => {
    const { result } = renderHook(() => useSearchHistory());

    await act(async () => {
      result.current.addToHistory('test query', { regex: false, caseSensitive: false });
    });

    expect(result.current.searchHistory).toHaveLength(1);
    expect(result.current.searchHistory[0].query).toBe('test query');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('should not add empty query', async () => {
    const { result } = renderHook(() => useSearchHistory());

    await act(async () => {
      result.current.addToHistory('', { regex: false, caseSensitive: false });
    });

    expect(result.current.searchHistory).toHaveLength(0);
  });

  it('should not add whitespace-only query', async () => {
    const { result } = renderHook(() => useSearchHistory());

    await act(async () => {
      result.current.addToHistory('   ', { regex: false, caseSensitive: false });
    });

    expect(result.current.searchHistory).toHaveLength(0);
  });

  it('should remove duplicate queries', async () => {
    const history = [
      { query: 'error', timestamp: 123, config: { regex: false, caseSensitive: false } },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(history));

    const { result } = renderHook(() => useSearchHistory());

    await act(async () => {
      result.current.addToHistory('error', { regex: true, caseSensitive: true });
    });

    expect(result.current.searchHistory).toHaveLength(1);
    expect(result.current.searchHistory[0].config.regex).toBe(true);
  });

  it('should remove item from history', async () => {
    const history = [
      { query: 'error', timestamp: 123, config: { regex: false, caseSensitive: false } },
      { query: 'warning', timestamp: 124, config: { regex: false, caseSensitive: false } },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(history));

    const { result } = renderHook(() => useSearchHistory());

    await act(async () => {
      result.current.removeFromHistory(0);
    });

    expect(result.current.searchHistory).toHaveLength(1);
    expect(result.current.searchHistory[0].query).toBe('warning');
  });

  it('should clear history', async () => {
    const history = [
      { query: 'error', timestamp: 123, config: { regex: false, caseSensitive: false } },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(history));

    const { result } = renderHook(() => useSearchHistory());

    await act(async () => {
      result.current.clearHistory();
    });

    expect(result.current.searchHistory).toHaveLength(0);
    expect(mockLocalStorage.removeItem).toHaveBeenCalled();
  });

  it('should handle invalid localStorage data', () => {
    mockLocalStorage.getItem.mockReturnValue('invalid json');

    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.searchHistory).toEqual([]);
  });
});
