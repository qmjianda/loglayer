/**
 * Ctrl+Shift+H 高亮选中文本快捷键验收测试（layer-interaction-redesign 阶段 2）
 *
 * 追溯 spec: layer-interaction → "快捷键高亮选中文本"
 * - 命令注册：layer.highlightSelection，shortcut Ctrl+Shift+H，类别 图层
 * - 触发 action：以选中文本为 query、最近使用色为 color 创建 HIGHLIGHT 图层
 * - 无最近使用色时用默认推荐色
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCommands } from './useCommands';
import { LayerType } from '../types';
import { addRecentColor, RECOMMENDED_COLORS } from '../constants/colors';

const baseDeps = () => ({
  handleOpenFolder: vi.fn(),
  handleToggleWatch: vi.fn(),
  findNextSearchMatchWithJump: vi.fn(),
  setIsGoToLineVisible: vi.fn(),
  setActiveView: vi.fn(),
  setIsCommandPaletteVisible: vi.fn(),
  setIsSettingsVisible: vi.fn(),
  setIsDebugVisible: vi.fn(),
  addLayer: vi.fn(),
  activeFileId: 'f1',
  activeFile: undefined,
  bookmarks: {},
});

const mockSelection = (text: string) => {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    toString: () => text,
  } as unknown as Selection);
};

describe('useCommands Ctrl+Shift+H 高亮选中文本（快捷键高亮选中文本）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('注册 layer.highlightSelection 命令（Ctrl+Shift+H，图层类）', () => {
    const { result } = renderHook(() => useCommands(baseDeps()));
    const cmd = result.current.find((c) => c.id === 'layer.highlightSelection');
    expect(cmd).toBeTruthy();
    expect(cmd?.shortcut).toBe('Ctrl+Shift+H');
    expect(cmd?.category).toBe('图层');
    expect(cmd?.label).toBeTruthy();
  });

  it('触发命令以选中文本为 query、最近使用色为 color 创建高亮图层', () => {
    addRecentColor('#22c55e');
    mockSelection('ERROR timeout');
    const deps = baseDeps();
    const { result } = renderHook(() => useCommands(deps));

    const cmd = result.current.find((c) => c.id === 'layer.highlightSelection')!;
    cmd.action();

    expect(deps.addLayer).toHaveBeenCalledWith(LayerType.HIGHLIGHT, {
      query: 'ERROR timeout',
      color: '#22c55e',
    });
  });

  it('无最近使用色时用默认推荐色创建', () => {
    mockSelection('WARN');
    const deps = baseDeps();
    const { result } = renderHook(() => useCommands(deps));

    const cmd = result.current.find((c) => c.id === 'layer.highlightSelection')!;
    cmd.action();

    expect(deps.addLayer).toHaveBeenCalledWith(LayerType.HIGHLIGHT, {
      query: 'WARN',
      color: RECOMMENDED_COLORS[0],
    });
  });

  it('无选中文本时不创建图层', () => {
    mockSelection('');
    const deps = baseDeps();
    const { result } = renderHook(() => useCommands(deps));

    const cmd = result.current.find((c) => c.id === 'layer.highlightSelection')!;
    cmd.action();

    expect(deps.addLayer).not.toHaveBeenCalled();
  });

  it('快捷键监听：Ctrl+Shift+H 触发高亮选中文本', () => {
    addRecentColor('#a855f7');
    mockSelection('DB timeout');
    const deps = baseDeps();
    renderHook(() => useCommands(deps));

    const e = new KeyboardEvent('keydown', {
      key: 'h',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(e);

    expect(deps.addLayer).toHaveBeenCalledWith(LayerType.HIGHLIGHT, {
      query: 'DB timeout',
      color: '#a855f7',
    });
  });

  it('快捷键监听：Ctrl+Shift+H 不触发新建图层命令（不冲突）', () => {
    mockSelection('');
    const deps = baseDeps();
    renderHook(() => useCommands(deps));

    const e = new KeyboardEvent('keydown', {
      key: 'h',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(e);

    expect(deps.addLayer).not.toHaveBeenCalled();
  });
});
