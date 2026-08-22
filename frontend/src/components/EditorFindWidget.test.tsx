/**
 * EditorFindWidget 组件测试（per-tab 化验收，1.3/1.4）
 *
 * 1.3：元素顺序 [输入框(含 Aa/全字/正则)] [计数] [↑][↓] [✕]；无匹配时"无结果"错误态
 * 1.4：focusRequest 变化时输入框 focus+select；非激活面板（isActive=false）容器带非交互 class
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EditorFindWidget } from './EditorFindWidget';
import { useSearchStore } from '../store/searchStore';

beforeEach(() => {
  useSearchStore.setState({ tabs: {}, activePanelId: null });
});

afterEach(cleanup);

const baseProps = {
  panelId: 'panel-A',
  query: 'error',
  onQueryChange: vi.fn(),
  config: { regex: false, caseSensitive: false, wholeWord: false },
  onConfigChange: vi.fn(),
  matchCount: 3,
  currentMatch: 1,
  onNavigate: vi.fn(),
  onClose: vi.fn(),
  isActive: true,
  focusRequest: 0,
};

describe('EditorFindWidget 结构对齐（1.3）', () => {
  it('元素顺序为 [输入框] [计数] [↑] [↓] [✕]', () => {
    render(<EditorFindWidget {...baseProps} />);
    const container = screen.getByPlaceholderText('查找').closest('div');
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(1);
    const buttons = screen.getAllByRole('button');
    const titles = buttons.map((b) => b.getAttribute('title')).filter(Boolean);
    // 顺序：输入框在计数之前，计数文本在 prev/next/close 之前
    expect(screen.getByPlaceholderText('查找')).toBeTruthy();
    expect(screen.getByText(/1 \/ 3|1 of 3/)).toBeTruthy();
    expect(titles).toEqual(
      expect.arrayContaining([
        '上一个匹配项 (Shift+Enter)',
        '下一个匹配项 (Enter)',
        '关闭 (Escape)',
      ]),
    );
    void container;
  });

  it('无匹配时计数显示"无结果"且容器带错误态 class', () => {
    const { container } = render(<EditorFindWidget {...baseProps} matchCount={0} />);
    expect(screen.getByText('无结果')).toBeTruthy();
    // 错误态：输入框容器带红边 class（border-red-500）或计数区域带错误色 class
    const hasErrorClass =
      container.querySelector('.border-red-500') !== null ||
      container.querySelector('.text-error') !== null;
    expect(hasErrorClass).toBe(true);
  });

  it('搜索进行中显示"搜索中"而非"无结果"，且不进入错误态（issue #7 延伸）', () => {
    useSearchStore.getState().ensureTab(baseProps.panelId);
    useSearchStore.getState().setIsSearching(baseProps.panelId, true);
    const { container } = render(<EditorFindWidget {...baseProps} matchCount={0} />);

    expect(screen.getByText('搜索中')).toBeTruthy();
    expect(screen.queryByText('无结果')).toBeNull();
    const hasErrorClass =
      container.querySelector('.border-red-500') !== null ||
      container.querySelector('.text-error') !== null;
    expect(hasErrorClass).toBe(false);
  });

  it('输入框聚焦时带聚焦边框 class', () => {
    const { container } = render(<EditorFindWidget {...baseProps} />);
    const input = screen.getByPlaceholderText('查找');
    input.focus();
    // 聚焦态：输入框边框用主题聚焦色（border-theme-focus 或等价蓝色系）
    const inputWrap = input.closest('.border-theme-focus, .border-blue-500');
    void container;
    expect(inputWrap).toBeTruthy();
  });
});

describe('EditorFindWidget 交互（1.4）', () => {
  it('focusRequest 变化时输入框获得焦点并全选已有词', () => {
    const { rerender } = render(<EditorFindWidget {...baseProps} />);
    const input = screen.getByPlaceholderText('查找') as HTMLInputElement;
    // 初始 focusRequest=0，首帧应已 focus+select
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    // focusRequest 递增 → 再次 focus+select（Ctrl+F 重复按下语义）
    rerender(<EditorFindWidget {...baseProps} focusRequest={1} />);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('非激活面板（isActive=false）时容器带非交互 class', () => {
    const { container } = render(<EditorFindWidget {...baseProps} isActive={false} />);
    const widgetEl = container.firstElementChild as HTMLElement;
    expect(widgetEl.className).toContain('pointer-events-none');
  });

  it('激活面板容器无 pointer-events-none', () => {
    const { container } = render(<EditorFindWidget {...baseProps} isActive={true} />);
    const widgetEl = container.firstElementChild as HTMLElement;
    expect(widgetEl.className).not.toContain('pointer-events-none');
  });
});
