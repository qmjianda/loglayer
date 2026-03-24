import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogViewerState } from '@/components/LogViewer/hooks/useLogViewerState';

describe('useLogViewerState', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    // Scroll state defaults
    expect(result.current.state.scrollTop).toBe(0);
    expect(result.current.state.scrollLeft).toBe(0);
    expect(result.current.state.viewportHeight).toBe(0);
    expect(result.current.state.viewportWidth).toBe(0);
    expect(result.current.state.maxLineWidth).toBe(0);
    
    // UI state defaults
    expect(result.current.state.contextMenu).toBeNull();
    expect(result.current.state.commentPopover).toBeNull();
    expect(result.current.state.expandedJsonLine).toBeNull();
    expect(result.current.state.showGoToLine).toBe(false);
    expect(result.current.state.showPerformancePanel).toBe(false);
    expect(result.current.state.performanceStats).toEqual({ fps: 60, visibleLines: 0, memory: 0 });
    
    // Selection state defaults
    expect(result.current.state.selection).toBeNull();
    expect(result.current.state.isSelecting).toBe(false);
    expect(result.current.state.hoveredLineIndex).toBeNull();
    expect(result.current.state.highlightedWord).toBeNull();
    
    // Data state defaults
    expect(result.current.state.bridgedLines).toBeInstanceOf(Map);
    expect(result.current.state.jumpPulseIndex).toBeNull();
  });
  
  it('should have all required actions', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    // Scroll actions
    expect(typeof result.current.actions.setScrollTop).toBe('function');
    expect(typeof result.current.actions.setScrollLeft).toBe('function');
    expect(typeof result.current.actions.setViewportHeight).toBe('function');
    expect(typeof result.current.actions.setViewportWidth).toBe('function');
    expect(typeof result.current.actions.setMaxLineWidth).toBe('function');
    
    // UI actions
    expect(typeof result.current.actions.setContextMenu).toBe('function');
    expect(typeof result.current.actions.setCommentPopover).toBe('function');
    expect(typeof result.current.actions.setExpandedJsonLine).toBe('function');
    expect(typeof result.current.actions.setShowGoToLine).toBe('function');
    expect(typeof result.current.actions.setShowPerformancePanel).toBe('function');
    expect(typeof result.current.actions.setPerformanceStats).toBe('function');
    
    // Selection actions
    expect(typeof result.current.actions.setSelection).toBe('function');
    expect(typeof result.current.actions.setIsSelecting).toBe('function');
    expect(typeof result.current.actions.setHoveredLineIndex).toBe('function');
    expect(typeof result.current.actions.setHighlightedWord).toBe('function');
    
    // Data actions
    expect(typeof result.current.actions.setBridgedLines).toBe('function');
    expect(typeof result.current.actions.setJumpPulseIndex).toBe('function');
  });
  
  it('should have refs initialized', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    expect(result.current.refs.lastFetchRef.current).toEqual({ start: -1, end: -1 });
    expect(result.current.refs.scrollVelocityRef.current).toBe(0);
    expect(result.current.refs.scrollDirectionRef.current).toBeNull();
    expect(result.current.refs.lastScrollTimeRef.current).toBe(0);
    expect(result.current.refs.lastScrollTopRef.current).toBe(0);
  });
  
  it('should update scroll state', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    act(() => {
      result.current.actions.setScrollTop(100);
    });
    expect(result.current.state.scrollTop).toBe(100);
    
    act(() => {
      result.current.actions.setScrollLeft(50);
    });
    expect(result.current.state.scrollLeft).toBe(50);
    
    act(() => {
      result.current.actions.setViewportHeight(800);
      result.current.actions.setViewportWidth(1200);
    });
    expect(result.current.state.viewportHeight).toBe(800);
    expect(result.current.state.viewportWidth).toBe(1200);
  });
  
  it('should update UI state', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    act(() => {
      result.current.actions.setContextMenu({ x: 100, y: 200, text: 'test', lineIndex: 5 });
    });
    expect(result.current.state.contextMenu).toEqual({ x: 100, y: 200, text: 'test', lineIndex: 5 });
    
    act(() => {
      result.current.actions.setShowGoToLine(true);
    });
    expect(result.current.state.showGoToLine).toBe(true);
    
    act(() => {
      result.current.actions.setPerformanceStats({ fps: 59, visibleLines: 100, memory: 256 });
    });
    expect(result.current.state.performanceStats).toEqual({ fps: 59, visibleLines: 100, memory: 256 });
  });
  
  it('should update selection state', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    act(() => {
      result.current.actions.setSelection({ startLine: 1, startChar: 5, endLine: 3, endChar: 10 });
    });
    expect(result.current.state.selection).toEqual({ startLine: 1, startChar: 5, endLine: 3, endChar: 10 });
    
    act(() => {
      result.current.actions.setIsSelecting(true);
    });
    expect(result.current.state.isSelecting).toBe(true);
    
    act(() => {
      result.current.actions.setHoveredLineIndex(10);
      result.current.actions.setHighlightedWord('error');
    });
    expect(result.current.state.hoveredLineIndex).toBe(10);
    expect(result.current.state.highlightedWord).toBe('error');
  });
  
  it('should update data state', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    const bridgedLines = new Map<number, any>();
    bridgedLines.set(1, { index: 1, content: 'test line' });
    
    act(() => {
      result.current.actions.setBridgedLines(bridgedLines);
    });
    expect(result.current.state.bridgedLines).toBe(bridgedLines);
    
    act(() => {
      result.current.actions.setJumpPulseIndex(50);
    });
    expect(result.current.state.jumpPulseIndex).toBe(50);
  });
  
  it('should support functional updates for showGoToLine', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    act(() => {
      result.current.actions.setShowGoToLine((prev) => !prev);
    });
    expect(result.current.state.showGoToLine).toBe(true);
    
    act(() => {
      result.current.actions.setShowGoToLine((prev) => !prev);
    });
    expect(result.current.state.showGoToLine).toBe(false);
  });
  
  it('should support functional updates for isSelecting', () => {
    const { result } = renderHook(() => useLogViewerState());
    
    act(() => {
      result.current.actions.setIsSelecting((prev) => !prev);
    });
    expect(result.current.state.isSelecting).toBe(true);
  });
});