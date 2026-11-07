/**
 * useLogLevelStats 竞态验收测试（log-level-stats 任务 1.5）
 *
 * 追溯 spec: log-level-stats → 前端统计请求竞态约束
 * - 切换激活文件后，旧文件的迟到响应不得覆盖新文件统计
 * - 旧响应不得提前关闭新文件的加载态
 * - 切换到无文件时清空统计
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogLevelStats } from './useLogLevelStats';

vi.mock('../bridge_client', () => ({
  getLogLevelStats: vi.fn(),
}));

import { getLogLevelStats } from '../bridge_client';

const mockGet = getLogLevelStats as ReturnType<typeof vi.fn>;

type Stats = Record<string, number>;

const makeStats = (errorCount: number): Stats => ({
  FATAL: 0,
  ERROR: errorCount,
  WARN: 0,
  INFO: 0,
  DEBUG: 0,
  TRACE: 0,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useLogLevelStats 请求竞态', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('切换文件后丢弃旧文件的迟到响应', async () => {
    const a = deferred<Stats>();
    const b = deferred<Stats>();
    mockGet.mockImplementation((fileId: string) => (fileId === 'A' ? a.promise : b.promise));

    const { result, rerender } = renderHook(({ id }) => useLogLevelStats(id), {
      initialProps: { id: 'A' },
    });

    let requestA!: Promise<void>;
    act(() => {
      requestA = result.current.refresh('A');
    });

    rerender({ id: 'B' });
    let requestB!: Promise<void>;
    act(() => {
      requestB = result.current.refresh('B');
    });

    await act(async () => {
      b.resolve(makeStats(2));
      await requestB;
    });
    await act(async () => {
      a.resolve(makeStats(99));
      await requestA;
    });

    expect(result.current.stats.ERROR).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it('旧响应不会提前关闭新文件的加载态', async () => {
    const a = deferred<Stats>();
    const b = deferred<Stats>();
    mockGet.mockImplementation((fileId: string) => (fileId === 'A' ? a.promise : b.promise));

    const { result, rerender } = renderHook(({ id }) => useLogLevelStats(id), {
      initialProps: { id: 'A' },
    });

    let requestA!: Promise<void>;
    act(() => {
      requestA = result.current.refresh('A');
    });

    rerender({ id: 'B' });
    let requestB!: Promise<void>;
    act(() => {
      requestB = result.current.refresh('B');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      a.resolve(makeStats(99));
      await requestA;
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      b.resolve(makeStats(3));
      await requestB;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.stats.ERROR).toBe(3);
  });

  it('切换到无文件时清空统计并结束加载态', async () => {
    const a = deferred<Stats>();
    mockGet.mockImplementation(() => a.promise);

    const { result, rerender } = renderHook(({ id }) => useLogLevelStats(id), {
      initialProps: { id: 'A' as string | null },
    });

    let requestA!: Promise<void>;
    act(() => {
      requestA = result.current.refresh('A');
    });

    rerender({ id: null });
    expect(result.current.stats.ERROR).toBe(0);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      a.resolve(makeStats(99));
      await requestA;
    });
    expect(result.current.stats.ERROR).toBe(0);
  });
});
