import { describe, it, expect } from 'vitest';
import { wheelDeltaToLogicalPx } from './wheelDelta';

/**
 * 验收测试：覆盖 openspec/changes/fix-wheel-scroll-scaling/specs/log-viewer-rendering/spec.md
 * 「滚轮滚动按行滚动 / deltaMode 归一化」场景。
 *
 * 契约：将 wheel 事件的 deltaY（含 deltaMode 语义）归一化为逻辑像素。
 */
describe('wheelDeltaToLogicalPx（滚轮归一化契约）', () => {
  const lineHeight = 20;
  const viewportHeight = 400;

  it('deltaMode=0（PIXEL）：deltaY 直接作为逻辑像素', () => {
    expect(wheelDeltaToLogicalPx(100, 0, lineHeight, viewportHeight)).toBe(100);
  });

  it('deltaMode=1（LINE）：deltaY × 行高', () => {
    expect(wheelDeltaToLogicalPx(3, 1, lineHeight, viewportHeight)).toBe(60);
  });

  it('deltaMode=2（PAGE）：deltaY × 视口高度', () => {
    expect(wheelDeltaToLogicalPx(1, 2, lineHeight, viewportHeight)).toBe(400);
  });

  it('向上滚动（负 deltaY）符号保留', () => {
    expect(wheelDeltaToLogicalPx(-3, 1, lineHeight, viewportHeight)).toBe(-60);
  });

  it('未知 deltaMode 回退为 deltaY 原值', () => {
    expect(wheelDeltaToLogicalPx(50, 99, lineHeight, viewportHeight)).toBe(50);
  });
});
