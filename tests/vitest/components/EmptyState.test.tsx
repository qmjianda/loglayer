import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../../../frontend/src/components/EmptyState';

describe('components/EmptyState', () => {
  it('should render the component', () => {
    const mockOnOpen = vi.fn();
    render(<EmptyState onOpen={mockOnOpen} />);
    
    expect(screen.getByText('将日志文件拖拽至此处打开')).toBeInTheDocument();
    expect(screen.getByText('或点击浏览并打开文件/文件夹')).toBeInTheDocument();
  });

  it('should show keyboard shortcuts', () => {
    const mockOnOpen = vi.fn();
    render(<EmptyState onOpen={mockOnOpen} />);
    
    expect(screen.getByText('分屏: Ctrl+\\ 或 Ctrl+Shift+\\')).toBeInTheDocument();
    expect(screen.getByText('关闭: Ctrl+W (保留至少1个分屏)')).toBeInTheDocument();
  });

  it('should call onOpen when clicked', () => {
    const mockOnOpen = vi.fn();
    render(<EmptyState onOpen={mockOnOpen} />);
    
    const container = screen.getByText('将日志文件拖拽至此处打开').closest('div');
    fireEvent.click(container!);
    
    expect(mockOnOpen).toHaveBeenCalledTimes(1);
  });

  it('should have correct CSS classes', () => {
    const mockOnOpen = vi.fn();
    const { container } = render(<EmptyState onOpen={mockOnOpen} />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('flex-1', 'flex', 'flex-col', 'items-center', 'justify-center');
    expect(mainDiv).toHaveClass('cursor-pointer');
  });
});
