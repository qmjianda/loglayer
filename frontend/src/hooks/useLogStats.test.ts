import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLogStats } from '../hooks/useLogStats';

describe('hooks/useLogStats', () => {
  it('should return empty stats for empty lines', () => {
    const { result } = renderHook(() => useLogStats([]));
    expect(result.current.total).toBe(0);
    expect(result.current.stats.ERROR).toBe(0);
    expect(result.current.stats.WARN).toBe(0);
    expect(result.current.stats.INFO).toBe(0);
  });

  it('should count ERROR level', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 ERROR Something went wrong',
      '2024-01-01 ERROR Another error',
      '2024-01-01 INFO Normal message',
    ]));
    expect(result.current.stats.ERROR).toBe(2);
    expect(result.current.stats.INFO).toBe(1);
  });

  it('should count WARN level', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 WARNING Something might be wrong',
      '2024-01-01 WARN Another warning',
    ]));
    expect(result.current.stats.WARN).toBe(2);
  });

  it('should count DEBUG level', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 DEBUG Debug message',
    ]));
    expect(result.current.stats.DEBUG).toBe(1);
  });

  it('should count TRACE level', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 TRACE Trace message',
    ]));
    expect(result.current.stats.TRACE).toBe(1);
  });

  it('should count multiple levels', () => {
    const { result } = renderHook(() => useLogStats([
      'ERROR error1',
      'WARN warn1',
      'INFO info1',
      'DEBUG debug1',
      'TRACE trace1',
    ]));
    expect(result.current.total).toBe(5);
    expect(result.current.stats.ERROR).toBe(1);
    expect(result.current.stats.WARN).toBe(1);
    expect(result.current.stats.INFO).toBe(1);
    expect(result.current.stats.DEBUG).toBe(1);
    expect(result.current.stats.TRACE).toBe(1);
  });

  it('should detect ERR as ERROR', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 ERR Short error',
    ]));
    expect(result.current.stats.ERROR).toBe(1);
  });

  it('should detect FATAL as ERROR', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 FATAL Critical failure',
    ]));
    expect(result.current.stats.ERROR).toBe(1);
  });

  it('should detect CRITICAL as ERROR', () => {
    const { result } = renderHook(() => useLogStats([
      '2024-01-01 CRITICAL System down',
    ]));
    expect(result.current.stats.ERROR).toBe(1);
  });

  it('should not count non-log lines', () => {
    const { result } = renderHook(() => useLogStats([
      'Just some random text',
      'Another line without level',
    ]));
    expect(result.current.stats.ERROR).toBe(0);
    expect(result.current.stats.WARN).toBe(0);
    expect(result.current.stats.INFO).toBe(0);
  });
});
