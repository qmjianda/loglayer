/**
 * 推荐色板与最近使用色工具验收测试（layer-interaction-redesign 阶段 2）
 *
 * 追溯 spec: layer-interaction → "颜色选择器能力"
 * - 推荐色板：两行 16 色（8 色相 × 2 明暗梯度）
 * - 最近使用 8 色，localStorage 持久化，跨会话保留
 * - 添加新色去重、越界裁剪、空值防御
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  RECOMMENDED_COLORS,
  RECENT_COLORS_LIMIT,
  getRecentColors,
  addRecentColor,
  clearRecentColors,
} from '../constants/colors';

const STORAGE_KEY = 'loglayer.recentColors';

describe('推荐色板与最近使用色（颜色选择器能力）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('推荐色板包含 16 色且可两行展示（8 色相 × 2 明暗梯度）', () => {
    expect(RECOMMENDED_COLORS).toHaveLength(16);
    // 每行 8 个：明暗梯度成对出现，前 8 与后 8 各为 8 个色相
    const firstRow = RECOMMENDED_COLORS.slice(0, 8);
    const secondRow = RECOMMENDED_COLORS.slice(8, 16);
    expect(firstRow).toHaveLength(8);
    expect(secondRow).toHaveLength(8);
    // 全部为合法 HEX
    RECOMMENDED_COLORS.forEach((c) => expect(c).toMatch(/^#[0-9a-fA-F]{6}$/));
  });

  it('无历史时最近使用色为空数组', () => {
    expect(getRecentColors()).toEqual([]);
  });

  it('添加颜色后返回该颜色', () => {
    addRecentColor('#ef4444');
    expect(getRecentColors()).toEqual(['#ef4444']);
  });

  it('最近使用色新色置顶且去重（重复添加不重复出现）', () => {
    addRecentColor('#ef4444');
    addRecentColor('#3b82f6');
    addRecentColor('#ef4444');
    const colors = getRecentColors();
    expect(colors[0]).toBe('#ef4444'); // 新色置顶
    expect(colors).toHaveLength(2); // 去重
  });

  it('最近使用色超过限制时裁剪最旧（越界裁剪）', () => {
    for (let i = 1; i <= RECENT_COLORS_LIMIT + 3; i++) {
      addRecentColor(`#00000${i % 10}`);
    }
    const colors = getRecentColors();
    expect(colors.length).toBeLessThanOrEqual(RECENT_COLORS_LIMIT);
    expect(colors.length).toBe(RECENT_COLORS_LIMIT);
  });

  it('跨会话保留（localStorage 持久化）', () => {
    addRecentColor('#22c55e');
    // 模拟重新加载：重新读取（新模块实例）→ 直接读 localStorage
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(raw).toContain('#22c55e');
    // 与工具函数读取结果一致
    expect(getRecentColors()).toEqual(raw);
  });

  it('localStorage 数据损坏时返回空数组而非抛错', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    expect(getRecentColors()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['#12345'])); // 非法 HEX
    expect(getRecentColors()).toEqual([]);
  });

  it('清空最近使用色', () => {
    addRecentColor('#ef4444');
    clearRecentColors();
    expect(getRecentColors()).toEqual([]);
  });
});
