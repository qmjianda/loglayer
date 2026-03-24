import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu, ContextMenuState } from './ContextMenu';

describe('ContextMenu', () => {
  const defaultContextMenu: ContextMenuState = {
    x: 100,
    y: 200,
    text: 'selected text',
    lineIndex: 5,
  };

  const mockProps = {
    contextMenu: defaultContextMenu,
    setContextMenu: vi.fn(),
    onAddLayer: vi.fn(),
    onToggleBookmark: vi.fn(),
    bridgedLines: new Map([[5, { content: 'test line content' }]]),
    setExpandedJsonLine: vi.fn(),
  };

  it('renders menu items when contextMenu is present', () => {
    render(<ContextMenu {...mockProps} />);
    
    expect(screen.getByText('复制选中内容')).toBeDefined();
    expect(screen.getByText('以此高亮')).toBeDefined();
    expect(screen.getByText('以此过滤')).toBeDefined();
    expect(screen.getByText('切换书签')).toBeDefined();
    expect(screen.getByText('复制整行')).toBeDefined();
  });

  it('does not render when contextMenu is null', () => {
    const { container } = render(
      <ContextMenu {...mockProps} contextMenu={null} setContextMenu={vi.fn()} bridgedLines={new Map()} setExpandedJsonLine={vi.fn()} />
    );
    
    expect(container.querySelector('.scale-in-center')).toBeNull();
  });

  it('calls setContextMenu on backdrop click', () => {
    const setContextMenu = vi.fn();
    render(
      <ContextMenu {...mockProps} setContextMenu={setContextMenu} />
    );
    
    const backdrop = document.querySelector('.z-\\[999\\]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(setContextMenu).toHaveBeenCalledWith(null);
    }
  });

  it('calls onAddLayer with HIGHLIGHT when clicking highlight option', () => {
    const onAddLayer = vi.fn();
    render(
      <ContextMenu {...mockProps} onAddLayer={onAddLayer} />
    );
    
    fireEvent.click(screen.getByText('以此高亮'));
    expect(onAddLayer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: 'selected text' })
    );
  });

  it('calls onAddLayer with FILTER when clicking filter option', () => {
    const onAddLayer = vi.fn();
    render(
      <ContextMenu {...mockProps} onAddLayer={onAddLayer} />
    );
    
    fireEvent.click(screen.getByText('以此过滤'));
    expect(onAddLayer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: 'selected text' })
    );
  });

  it('calls onToggleBookmark when clicking bookmark option', () => {
    const onToggleBookmark = vi.fn();
    render(
      <ContextMenu {...mockProps} onToggleBookmark={onToggleBookmark} />
    );
    
    fireEvent.click(screen.getByText('切换书签'));
    expect(onToggleBookmark).toHaveBeenCalledWith(5);
  });

  it('does not show JSON option for non-JSON text', () => {
    render(<ContextMenu {...mockProps} />);
    
    expect(screen.queryByText('展开 JSON')).toBeNull();
  });

  it('shows JSON option for valid JSON text', () => {
    const jsonMenuProps = {
      ...mockProps,
      contextMenu: { ...defaultContextMenu, text: '{"key": "value"}' },
    };
    render(<ContextMenu {...jsonMenuProps} />);
    
    expect(screen.getByText('展开 JSON')).toBeDefined();
  });
});