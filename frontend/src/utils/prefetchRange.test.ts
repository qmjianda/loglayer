import { describe, it, expect } from 'vitest';
import { computePrefetchRange } from './prefetchRange';

/**
 * 验收测试：覆盖 openspec/changes/fix-scroll-empty-screen/specs/preload-optimization/spec.md
 * 「预加载 buffer 充足 / 静态对称预取」场景。
 *
 * 契约：返回「可视区 ± M」且 clamp 到 [0, totalLines) 的连续区间 { start, end }。
 */
describe('computePrefetchRange（preload-optimization 契约）', () => {
  it('中部正常：返回可视区前后各 M 行的区间', () => {
    // topVisibleLine=500, visibleRows=20, M=100, totalLines=1000
    // start = 500-100 = 400；end = 500+20+100 = 620
    expect(computePrefetchRange(500, 20, 100, 1000)).toEqual({ start: 400, end: 620 });
  });

  it('顶部越界：start clamp 到 0', () => {
    // topVisibleLine=10, M=100 → 10-100 < 0 → start=0
    expect(computePrefetchRange(10, 20, 100, 1000)).toEqual({ start: 0, end: 130 });
  });

  it('底部越界：end clamp 到 totalLines', () => {
    // topVisibleLine=980, visibleRows=20, M=100 → 980+20+100=1100 > 1000 → end=1000
    expect(computePrefetchRange(980, 20, 100, 1000)).toEqual({ start: 880, end: 1000 });
  });

  it('小文件全量覆盖：整个文件都在预取区间内', () => {
    // totalLines=10 小于可视区±M，直接全量 [0, 10)
    expect(computePrefetchRange(0, 5, 100, 10)).toEqual({ start: 0, end: 10 });
  });

  it('空文件：返回空区间', () => {
    expect(computePrefetchRange(0, 20, 100, 0)).toEqual({ start: 0, end: 0 });
  });

  it('M=0：仅可视区，不预取', () => {
    expect(computePrefetchRange(500, 20, 0, 1000)).toEqual({ start: 500, end: 520 });
  });
});
