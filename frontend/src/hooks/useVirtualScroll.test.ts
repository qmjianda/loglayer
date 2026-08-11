/**
 * FPS 采集纯函数验收测试（perf-deepening / render-throttling）
 *
 * 追溯 spec: render-throttling → "前端帧率可观测"
 * - computeAverageFps 计算最近时段平均帧率（四舍五入）
 * - isLowFps 低帧率阈值（< 30 标记）
 */
import { describe, it, expect } from 'vitest';
import { computeAverageFps, isLowFps } from './useVirtualScroll';

describe('computeAverageFps（前端帧率可观测）', () => {
  it('计算平均帧率（四舍五入）', () => {
    expect(computeAverageFps([60, 60, 60])).toBe(60);
    expect(computeAverageFps([58, 59, 60])).toBe(59);
    expect(computeAverageFps([30, 30])).toBe(30);
  });

  it('空样本返回 0', () => {
    expect(computeAverageFps([])).toBe(0);
  });
});

describe('isLowFps（低帧率标记）', () => {
  it('平均 FPS < 30 标记低帧率', () => {
    expect(isLowFps(29)).toBe(true);
    expect(isLowFps(0)).toBe(true);
  });

  it('平均 FPS >= 30 不标记', () => {
    expect(isLowFps(30)).toBe(false);
    expect(isLowFps(60)).toBe(false);
  });
});
