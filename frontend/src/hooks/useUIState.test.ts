import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIState } from '../hooks/useUIState';

const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockSetSearchQuery = vi.fn();

describe('hooks/useUIState', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getSelection: vi.fn().mockReturnValue(null),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should have default state', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    expect(result.current.activeView).toBe('main');
    expect(result.current.sidebarWidth).toBe(288);
    expect(result.current.isFindVisible).toBe(false);
    expect(result.current.isGoToLineVisible).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.loadingProgress).toBe(0);
  });

  it('should set active view', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setActiveView('search');
    });

    expect(result.current.activeView).toBe('search');
  });

  it('should set sidebar width', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setSidebarWidth(400);
    });

    expect(result.current.sidebarWidth).toBe(400);
  });

  it('should toggle find visibility', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setIsFindVisible(true);
    });

    expect(result.current.isFindVisible).toBe(true);

    act(() => {
      result.current.setIsFindVisible(false);
    });

    expect(result.current.isFindVisible).toBe(false);
  });

  it('should toggle go to line visibility', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setIsGoToLineVisible(true);
    });

    expect(result.current.isGoToLineVisible).toBe(true);
  });

  it('should set scroll to index', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setScrollToIndex(100);
    });

    expect(result.current.scrollToIndex).toBe(100);
  });

  it('should set highlighted index', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setHighlightedIndex(50);
    });

    expect(result.current.highlightedIndex).toBe(50);
  });

  it('should set processing status', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setIsProcessing(true);
    });

    expect(result.current.isProcessing).toBe(true);

    act(() => {
      result.current.setLoadingProgress(50);
    });

    expect(result.current.loadingProgress).toBe(50);
  });

  it('should set operation status', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setOperationStatus({ op: 'indexing', progress: 50 });
    });

    expect(result.current.operationStatus).toEqual({ op: 'indexing', progress: 50 });

    act(() => {
      result.current.setOperationStatus(null);
    });

    expect(result.current.operationStatus).toBeNull();
  });

  it('should set workspace root', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setWorkspaceRoot({ path: '/test/path', name: 'test' });
    });

    expect(result.current.workspaceRoot).toEqual({ path: '/test/path', name: 'test' });
  });

  it('should handle jump to line', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.handleJumpToLine(100, 1000);
    });

    expect(result.current.scrollToIndex).toBe(100);
    expect(result.current.highlightedIndex).toBe(100);
  });

  it('should handle jump to line with out of bounds index', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.handleJumpToLine(2000, 1000);
    });

    expect(result.current.scrollToIndex).toBe(999);
  });

  it('should handle jump to line with zero total', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.handleJumpToLine(100, 0);
    });

    expect(result.current.scrollToIndex).toBeNull();
  });

  it('should set file watch state', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setIsWatching(true);
    });

    expect(result.current.isWatching).toBe(true);

    act(() => {
      result.current.setHasNewContent(true);
    });

    expect(result.current.hasNewContent).toBe(true);
  });

  it('should handle log viewer interaction', () => {
    const { result } = renderHook(() => useUIState({
      undo: mockUndo,
      redo: mockRedo,
      setSearchQuery: mockSetSearchQuery,
      searchQuery: '',
    }));

    act(() => {
      result.current.setHighlightedIndex(50);
    });

    act(() => {
      result.current.handleLogViewerInteraction();
    });

    expect(result.current.highlightedIndex).toBeNull();
  });
});
