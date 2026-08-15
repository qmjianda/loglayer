import { describe, it, expect } from 'vitest';
import { computeViewportTranslateY } from './viewportTranslate';

/**
 * 回归测试：超大文件滚动压缩下，内容按逻辑滚动连续对齐，不按 floor 整行跳动。
 *
 * 不变式：行 viewport 位置 = 逻辑位置 - 逻辑滚动（连续）。
 * 旧实现 `scrollTop - windowOffsetPx`（windowOffsetPx 按 floor(logicalScrollTop/lineHeight) 取整）
 * 会在半行处返回 0（stuck）而非 -10，从而被本测试拦截。
 */
describe('computeViewportTranslateY（滚动压缩平滑对齐）', () => {
  const lineHeight = 20;
  const scale = 15.27; // 2290 万行文件：maxLogical/maxPhysical

  it('非缩放（逻辑=物理滚动）：transform 恒为窗口逻辑基准，与滚动量无关', () => {
    expect(computeViewportTranslateY(50, lineHeight, 1000, 1000)).toBe(50 * lineHeight);
    expect(computeViewportTranslateY(50, lineHeight, 2345, 2345)).toBe(50 * lineHeight);
  });

  it('缩放模式：行视口位置 = 逻辑位置 - 逻辑滚动（连续，半行处不 stuck）', () => {
    // 逻辑滚半行（10px）→ 行 0 视口应为 -10（半行滚出），而非 0
    const halfLogical = 10;
    const halfPhysical = halfLogical / scale;
    const viewportAtHalf =
      computeViewportTranslateY(0, lineHeight, halfLogical, halfPhysical) - halfPhysical;
    expect(viewportAtHalf).toBeCloseTo(-halfLogical);

    // 逻辑滚一整行（20px）→ 行 0 视口应为 -20
    const oneLogical = 20;
    const onePhysical = oneLogical / scale;
    const viewportAtOne =
      computeViewportTranslateY(0, lineHeight, oneLogical, onePhysical) - onePhysical;
    expect(viewportAtOne).toBeCloseTo(-oneLogical);
  });

  it('缩放模式：窗口基准平移，首行为 windowStart', () => {
    // 窗口已 re-anchor 到 windowStart=25，逻辑滚到 25 行处：首行（25）视口应为 0
    const ws = 25;
    const logical = ws * lineHeight;
    const physical = logical / scale;
    const viewportOfFirstRow =
      computeViewportTranslateY(ws, lineHeight, logical, physical) + 0 * lineHeight - physical;
    expect(viewportOfFirstRow).toBeCloseTo(0);
  });
});
