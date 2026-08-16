/**
 * ColorPicker 升级验收测试（layer-interaction-redesign 阶段 2）
 *
 * 追溯 spec: layer-interaction → "颜色选择器能力"
 * - 推荐色板：两行 16 色，点选即应用
 * - HEX 输入框：输入合法颜色应用
 * - 最近使用色：从 localStorage 读取并展示
 * - 取色器：EyeDropper 可用时显示按钮，不可用时隐藏
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from './ColorPicker';
import { RECOMMENDED_COLORS, addRecentColor } from '../../constants/colors';

describe('ColorPicker 升级（颜色选择器能力）', () => {
  beforeEach(() => {
    localStorage.clear();
    // 默认模拟无 EyeDropper（Firefox 场景）
    Object.defineProperty(window, 'EyeDropper', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('渲染当前选中色块与 HEX 值', () => {
    render(<ColorPicker selectedColor="#ef4444" onColorChange={() => {}} />);
    const hex = screen.getByDisplayValue('#EF4444');
    expect(hex).toBeTruthy();
  });

  it('展示推荐色板（两行 16 色），点选即应用', () => {
    const onColorChange = vi.fn();
    render(<ColorPicker selectedColor="#3b82f6" onColorChange={onColorChange} />);

    // 全部推荐色渲染为色块按钮
    RECOMMENDED_COLORS.forEach((c) => {
      expect(screen.getByTitle(c)).toBeTruthy();
    });

    const target = RECOMMENDED_COLORS[3];
    fireEvent.click(screen.getByTitle(target));
    expect(onColorChange).toHaveBeenCalledWith(target);
  });

  it('HEX 输入框输入合法颜色值应用', () => {
    const onColorChange = vi.fn();
    render(<ColorPicker selectedColor="#3b82f6" onColorChange={onColorChange} />);
    const hex = screen.getByDisplayValue('#3B82F6') as HTMLInputElement;
    fireEvent.change(hex, { target: { value: '#22c55e' } });
    expect(onColorChange).toHaveBeenCalledWith('#22c55e');
  });

  it('HEX 输入非法值不应用', () => {
    const onColorChange = vi.fn();
    render(<ColorPicker selectedColor="#3b82f6" onColorChange={onColorChange} />);
    const hex = screen.getByDisplayValue('#3B82F6') as HTMLInputElement;
    fireEvent.change(hex, { target: { value: '#xyz' } });
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it('有最近使用色时展示在最近使用区域', () => {
    addRecentColor('#123456');
    addRecentColor('#654321');
    render(<ColorPicker selectedColor="#3b82f6" onColorChange={() => {}} />);
    expect(screen.getByText('最近')).toBeTruthy();
    expect(screen.getByTitle('#123456')).toBeTruthy();
    expect(screen.getByTitle('#654321')).toBeTruthy();
  });

  it('无 EyeDropper 时不渲染取色器按钮', () => {
    render(<ColorPicker selectedColor="#3b82f6" onColorChange={() => {}} />);
    expect(screen.queryByTitle('取色')).toBeNull();
  });

  it('有 EyeDropper 时渲染取色器按钮', () => {
    class FakeEyeDropper {
      async open() {
        return { sRGBHex: '#111111' };
      }
    }
    Object.defineProperty(window, 'EyeDropper', {
      value: FakeEyeDropper,
      writable: true,
      configurable: true,
    });
    const onColorChange = vi.fn();
    render(<ColorPicker selectedColor="#3b82f6" onColorChange={onColorChange} />);
    expect(screen.getByTitle('取色')).toBeTruthy();
  });
});
