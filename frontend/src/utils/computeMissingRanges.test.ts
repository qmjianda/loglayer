import { describe, it, expect } from 'vitest';
import { computeMissingRanges } from './prefetchRange';

describe('computeMissingRanges 缺口对账 (D2)', () => {
  it('无缺口：全部命中返回空', () => {
    const cached = new Set([0, 1, 2, 3, 4]);
    expect(computeMissingRanges(cached, 0, 5)).toEqual([]);
  });

  it('单连续缺口：返回一个区间', () => {
    const cached = new Set([0, 1, 4, 5]);
    expect(computeMissingRanges(cached, 0, 6)).toEqual([{ start: 2, end: 4 }]);
  });

  it('多段缺口：返回合并后的最小子区间列表', () => {
    const cached = new Set([0, 3, 6]);
    // window [0,7): missing 1,2  and 4,5
    expect(computeMissingRanges(cached, 0, 7)).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 6 },
    ]);
  });

  it('首尾缺口：窗口边界缺失', () => {
    const cached = new Set([2, 3]);
    expect(computeMissingRanges(cached, 0, 5)).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 5 },
    ]);
  });

  it('空缓存：返回整个窗口', () => {
    expect(computeMissingRanges(new Set(), 10, 15)).toEqual([{ start: 10, end: 15 }]);
  });

  it('支持 Map 输入（bridgedLines）', () => {
    const m = new Map<number, string>([
      [10, 'a'],
      [12, 'c'],
    ]);
    expect(computeMissingRanges(m, 10, 13)).toEqual([{ start: 11, end: 12 }]);
  });

  it('空窗口返回空', () => {
    expect(computeMissingRanges(new Set([1, 2]), 5, 5)).toEqual([]);
  });
});
