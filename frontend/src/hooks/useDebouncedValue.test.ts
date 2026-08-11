/**
 * 统一搜索防抖 hook 验收测试（perf-deepening / search-debounce）
 *
 * 追溯 spec: search-debounce → "统一单层搜索防抖"
 * - 250ms 内连续输入仅触发最后一次（去抖值在窗口内不更新）
 * - 窗口结束后返回最新值（仅最后一次触发）
 * - 输入间隔超过延迟逐次更新（不吞掉独立输入）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from './useDebouncedValue';

const DEBOUNCE = SEARCH_DEBOUNCE_MS; // 统一 250ms

describe('useDebouncedValue（统一单层搜索防抖）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('延迟窗口内连续输入不更新（仅最后一次触发）', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, DEBOUNCE), {
      initialProps: { v: 'e' },
    });
    rerender({ v: 'er' });
    rerender({ v: 'err' });
    rerender({ v: 'erro' });
    expect(result.current).toBe('e'); // 窗口内保持首个值
  });

  it('窗口结束后返回最新值（触发一次）', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, DEBOUNCE), {
      initialProps: { v: 'e' },
    });
    rerender({ v: 'erro' });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(result.current).toBe('erro');
  });

  it('输入间隔超过延迟则逐次更新（不吞掉独立输入）', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, DEBOUNCE), {
      initialProps: { v: 'error' },
    });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(result.current).toBe('error');

    rerender({ v: 'timeout' });
    expect(result.current).toBe('error'); // 新输入窗口内仍为旧值
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE);
    });
    expect(result.current).toBe('timeout');
  });
});
