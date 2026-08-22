import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileLoadingSkeleton, IndexingOverlay } from './LoadingOverlays';

describe('核心等待态统一文案（issue #7）', () => {
  it('索引覆盖层显示文件加载中并保留进度和文件名', () => {
    render(<IndexingOverlay progress={42} fileName="app.log" />);

    expect(screen.getByText('文件加载中')).toBeTruthy();
    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.getByText('app.log')).toBeTruthy();
  });

  it('文件加载骨架显示文件加载中并保留文件名', () => {
    render(<FileLoadingSkeleton fileName="server.log" />);

    expect(screen.getByText('文件加载中')).toBeTruthy();
    expect(screen.getByText('server.log')).toBeTruthy();
  });
});
