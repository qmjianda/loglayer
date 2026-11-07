import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel';

describe('KeyboardShortcutsPanel', () => {
  it('只展示当前实现的快捷键', () => {
    render(<KeyboardShortcutsPanel isOpen onClose={() => undefined} />);

    expect(screen.getByText('Ctrl + Shift + T')).toBeTruthy();
    expect(screen.getByText('开始或停止文件监视')).toBeTruthy();
    expect(screen.getByText('Ctrl + Shift + D')).toBeTruthy();
    expect(screen.queryByText('选中当前行')).toBeNull();
    expect(screen.queryByText('收藏当前行')).toBeNull();
  });
});
