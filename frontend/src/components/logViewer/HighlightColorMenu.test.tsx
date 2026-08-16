/**
 * 右键高亮色板子菜单验收测试（layer-interaction-redesign 阶段 2）
 *
 * 追溯 spec: layer-interaction → "右键创建带色高亮"
 * - 子菜单含推荐色与最近使用色，最近使用色置顶
 * - 点选颜色即回调 onPick(color)，一步创建带色高亮
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HighlightColorMenu } from './HighlightColorMenu';
import { RECOMMENDED_COLORS, addRecentColor, getRecentColors } from '../../constants/colors';

describe('HighlightColorMenu 右键色板子菜单（右键创建带色高亮）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hover 按钮后展开推荐色板（16 色）', () => {
    render(<HighlightColorMenu onPick={vi.fn()} />);

    // 初始只显示主按钮
    expect(screen.getByRole('button', { name: /高亮/ })).toBeTruthy();
    expect(screen.queryByTitle(RECOMMENDED_COLORS[0])).toBeNull();

    fireEvent.mouseEnter(screen.getByRole('button', { name: /高亮/ }));
    RECOMMENDED_COLORS.forEach((c) => {
      expect(screen.getByTitle(c)).toBeTruthy();
    });
  });

  it('点选颜色回调 onPick 并带上该颜色', () => {
    const onPick = vi.fn();
    render(<HighlightColorMenu onPick={onPick} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /高亮/ }));

    const target = RECOMMENDED_COLORS[5];
    fireEvent.click(screen.getByTitle(target));
    expect(onPick).toHaveBeenCalledWith(target);
  });

  it('最近使用色显示在色板区（未 hover 前按钮不出现）', () => {
    addRecentColor('#123456');
    render(<HighlightColorMenu onPick={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /高亮/ }));

    expect(screen.getByTitle('#123456')).toBeTruthy();
  });

  it('点选颜色后记录为最近使用色', () => {
    const onPick = vi.fn();
    render(<HighlightColorMenu onPick={onPick} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: /高亮/ }));
    fireEvent.click(screen.getByTitle(RECOMMENDED_COLORS[2]));

    expect(getRecentColors()).toContain(RECOMMENDED_COLORS[2]);
  });
});
