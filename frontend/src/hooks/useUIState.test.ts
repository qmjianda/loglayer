/**
 * useUIState 快捷键冲突回归测试（layer-interaction-redesign 反馈 #6）
 *
 * 追溯 spec: layer-interaction → "快捷键高亮选中文本"
 * - Ctrl+H 触发搜索历史（原有）
 * - Ctrl+Shift+H 不触发搜索历史（让位给"高亮选中文本"，由 useCommands 处理）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUIState } from './useUIState';

const baseProps = () => ({
  undo: vi.fn(),
  redo: vi.fn(),
  setSearchQuery: vi.fn(),
  searchQuery: '',
  canvasSelectedText: '',
  onToggleSidebar: vi.fn(),
  onOpenFile: vi.fn(),
  onOpenFolder: vi.fn(),
  onShowSearchHistory: vi.fn(),
});

const fireKey = (key: string, opts: { ctrl?: boolean; shift?: boolean } = {}) => {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        ctrlKey: !!opts.ctrl,
        shiftKey: !!opts.shift,
        bubbles: true,
      }),
    );
  });
};

describe('useUIState 快捷键（快捷键高亮选中文本）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Ctrl+H 触发搜索历史', () => {
    const props = baseProps();
    renderHook(() => useUIState(props));
    fireKey('h', { ctrl: true });
    expect(props.onShowSearchHistory).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+H 不触发搜索历史（让位给高亮选中文本）', () => {
    const props = baseProps();
    renderHook(() => useUIState(props));
    fireKey('h', { ctrl: true, shift: true });
    expect(props.onShowSearchHistory).not.toHaveBeenCalled();
  });
});
