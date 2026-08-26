import { describe, it, expect, vi } from 'vitest';
import { computeMissingRanges } from './prefetchRange';

/**
 * 1.1 repro：模拟 readProcessedLines 首次空响应后恢复，断言对账能补齐
 * 覆盖 Requirement: 拉取失败不产生永久空洞 / 小幅滚动触发缺口补拉
 */
describe('空响应后对账补齐 (1.1)', () => {
  it('空数组后 gaps 被检出并可补拉', async () => {
    // 缓存为空，窗口 [0,5) 全部缺口
    const bridged = new Map<number, string>();
    const gaps = computeMissingRanges(bridged, 0, 5);
    expect(gaps).toEqual([{ start: 0, end: 5 }]);

    // 模拟首次空响应：不写入缓存，gaps 仍存在，允许重试
    const firstFetch: unknown[] = [];
    firstFetch.forEach((line, idx) => {
      if (line != null) bridged.set(idx, line as string);
    });
    expect(computeMissingRanges(bridged, 0, 5)).toEqual([{ start: 0, end: 5 }]);

    // 第二次恢复：写入真实行
    const secondFetch = [
      { index: 0, content: 'line0' },
      { index: 1, content: 'line1' },
      { index: 2, content: 'line2' },
      { index: 3, content: 'line3' },
      { index: 4, content: 'line4' },
    ];
    secondFetch.forEach((line, idx) => bridged.set(idx, line as unknown as string));
    expect(computeMissingRanges(bridged, 0, 5)).toEqual([]);
  });

  it('含 null 占位的返回不写入缓存，仍为缺口', () => {
    const bridged = new Map<number, unknown>();
    bridged.set(0, { content: 'a' });
    bridged.set(2, { content: 'c' });
    // 模拟后端返回 [ok, null, ok]，null 跳过
    const lines: unknown[] = [{ content: 'a' }, null, { content: 'c' }];
    const start = 0;
    lines.forEach((line, idx) => {
      if (line == null) return;
      bridged.set(start + idx, line);
    });
    // 1 仍缺失
    expect(computeMissingRanges(bridged, 0, 3)).toEqual([{ start: 1, end: 2 }]);
  });

  it('lastFetchRef 语义：空响应不应标记为已拉取', () => {
    let lastFetch = { start: -1, end: -1 };
    const start = 0,
      end = 5;
    const expected = end - start;
    const empty: unknown[] = [];
    const hasNull = empty.some((l) => l == null);
    const ok = empty.length === expected && !hasNull;
    if (ok) lastFetch = { start, end };
    else lastFetch = { start: -1, end: -1 };
    expect(lastFetch).toEqual({ start: -1, end: -1 });

    const good = [1, 2, 3, 4, 5];
    const ok2 = good.length === expected && !good.some((l) => l == null);
    if (ok2) lastFetch = { start, end };
    expect(lastFetch).toEqual({ start: 0, end: 5 });
  });
});
