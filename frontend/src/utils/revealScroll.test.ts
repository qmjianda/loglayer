import { describe, it, expect } from 'vitest';
import { computeRevealScrollTop } from './revealScroll';

/**
 * 验收测试：覆盖 openspec/changes/jump-reveal-without-centering/specs/jump-navigation/spec.md
 * 全部 WHEN-THEN 场景。
 *
 * 基准视口：显示第 100~300 行（topVisibleLine=100, visibleRows=200）
 * 行高 20px，视口高 4000px，文件 1000 行：
 *   maxLogicalScroll = 1000*20 - 4000 = 16000
 *   安全区 = [101, 299]
 */
const BASE = {
  topVisibleLine: 100,
  visibleRows: 200,
  viewportHeight: 4000,
  lineHeight: 20,
  maxLogicalScroll: 16000,
  maxPhysicalScroll: 16000,
  useScaling: false,
};

describe('computeRevealScrollTop（jump-navigation 契约）', () => {
  it('目标行在视口中部 → 不滚动（null）', () => {
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        150,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBeNull();
  });

  it('目标行在底部安全区下限（299）→ 不滚动（null）', () => {
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        299,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBeNull();
  });

  it('目标行在顶部安全区上限（101）→ 不滚动（null）', () => {
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        101,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBeNull();
  });

  it('目标行在视口顶部安全区内（100）→ 居中（1/2 正中）', () => {
    // 100*20 - 4000/2 = 0（目标行顶部 2000px 落在视口正中 2000px 处）
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        100,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBe(0);
  });

  it('目标行在视口上方且可居中（200，视口 300~500）→ 居中 1/2', () => {
    // 目标行顶部 4000px，scrollTop=2000 时位于视口（2000~6000）正中
    expect(computeRevealScrollTop(300, 200, 4000, 20, 200, 16000, 16000, false)).toBe(2000);
  });

  it('目标行在视口上方且贴近文件头（50）→ clamp 到顶 0', () => {
    // 50*20 - 4000/2 = -1000 → max(0, …) = 0（文件头无法居中，贴顶）
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        50,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBe(0);
  });

  it('目标行在视口下方（800）→ 居中 1/2', () => {
    // 800*20 - 4000/2 = 14000（目标行顶部 16000px，位于视口 14000~18000 正中）
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        800,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBe(14000);
  });

  it('目标为最后一行（999）→ clamp 到底 = 贴底', () => {
    // 999*20 - 4000/2 = 17980 > maxLogicalScroll(16000) → clamp 到 16000
    expect(
      computeRevealScrollTop(
        BASE.topVisibleLine,
        BASE.visibleRows,
        BASE.viewportHeight,
        BASE.lineHeight,
        999,
        BASE.maxLogicalScroll,
        BASE.maxPhysicalScroll,
        BASE.useScaling,
      ),
    ).toBe(16000);
  });

  it('useScaling 模式：物理/逻辑映射换算', () => {
    // maxLogical=200000, maxPhysical=100000；目标 5000 行（视口外）
    // targetLogical = 5000*20 - 4000/2 = 98000 → 98000/200000*100000 = 49000
    expect(computeRevealScrollTop(100, 200, 4000, 20, 5000, 200000, 100000, true)).toBe(49000);
  });

  it('useScaling 模式：可见目标不滚动（null）', () => {
    expect(computeRevealScrollTop(100, 200, 4000, 20, 150, 200000, 100000, true)).toBeNull();
  });
});
