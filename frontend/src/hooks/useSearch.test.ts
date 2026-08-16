/**
 * useSearch 数据层配置防抖验收测试（layer-interaction-redesign 阶段 4）
 *
 * 追溯 spec: layer-interaction → "配置生效策略"
 * - 数据层（FILTER/TRANSFORM）配置输入防抖 ~400ms 后触发后端 syncAll 重算
 * - 快速连续变更只触发最后一次（防抖语义）
 * - 视觉层配置变更同样经防抖但前端渲染本地即时（syncAll 仅是元数据同步）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch, LAYER_SYNC_DEBOUNCE_MS } from './useSearch';

vi.mock('../bridge_client', () => ({
  syncAll: vi.fn(),
}));

import { syncAll } from '../bridge_client';
import { useSearchStore } from '../store/searchStore';
import { LayerType } from '../types';
import type { LogLayer } from '../types';

const mockSyncAll = syncAll as ReturnType<typeof vi.fn>;

const baseProps = () => ({
  activeFileId: 'f1',
  activePanelId: 'p1',
  layers: [] as LogLayer[],
  layersFunctionalHash: 'hash-v1',
  lineCount: 100,
  searchMatchCount: 0,
  setProcessedCache: vi.fn(),
});

describe('useSearch 数据层配置防抖（配置生效策略）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSyncAll.mockClear();
    useSearchStore.getState().ensureTab('p1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('图层配置变化后经防抖窗口才触发 syncAll', () => {
    const { rerender } = renderHook((p) => useSearch(p), { initialProps: baseProps() });

    // 变更 layersFunctionalHash（模拟数据层配置输入）
    rerender({ ...baseProps(), layersFunctionalHash: 'hash-v2' });

    expect(mockSyncAll).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(LAYER_SYNC_DEBOUNCE_MS);
    });
    expect(mockSyncAll).toHaveBeenCalledTimes(1);
  });

  it('防抖窗口内连续多次变更只触发一次 syncAll（最后一次）', () => {
    const { rerender } = renderHook((p) => useSearch(p), { initialProps: baseProps() });

    rerender({ ...baseProps(), layersFunctionalHash: 'hash-v2' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ ...baseProps(), layersFunctionalHash: 'hash-v3' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ ...baseProps(), layersFunctionalHash: 'hash-v4' });

    expect(mockSyncAll).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(LAYER_SYNC_DEBOUNCE_MS);
    });
    expect(mockSyncAll).toHaveBeenCalledTimes(1);
  });

  it('syncAll 携带当前图层数据调用', () => {
    const layers: LogLayer[] = [
      {
        id: 'l1',
        name: '错误过滤',
        type: LayerType.FILTER,
        enabled: true,
        config: { query: 'ERROR' },
      },
    ];
    const { rerender } = renderHook((p) => useSearch(p), {
      initialProps: baseProps(),
    });

    rerender({ ...baseProps(), layers, layersFunctionalHash: 'hash-v2' });
    act(() => {
      vi.advanceTimersByTime(LAYER_SYNC_DEBOUNCE_MS);
    });

    expect(mockSyncAll).toHaveBeenCalledWith('f1', layers, null, expect.any(AbortSignal));
  });
});
