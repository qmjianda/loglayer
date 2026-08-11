/**
 * SkeletonRows 行级骨架占位验收测试（perf-deepening / loading-skeletons）
 *
 * 追溯 spec: loading-skeletons → "搜索结果行级骨架"
 * - 搜索加载中渲染行级骨架占位（animate-pulse）
 * - 按 count 渲染对应行数
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonRows } from './SkeletonRows';

describe('SkeletonRows（搜索结果行级骨架）', () => {
  it('按 count 渲染行级骨架占位（animate-pulse）', () => {
    render(<SkeletonRows count={4} />);
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(4);
    expect(screen.getByTestId('skeleton-rows').querySelector('.animate-pulse')).toBeTruthy();
  });

  it('默认 count 渲染且 aria-busy 标记', () => {
    render(<SkeletonRows />);
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(screen.getByTestId('skeleton-rows').getAttribute('aria-busy')).toBe('true');
  });
});
