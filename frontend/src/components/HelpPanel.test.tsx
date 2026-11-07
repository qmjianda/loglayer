import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpPanel } from './HelpPanel';

describe('HelpPanel', () => {
  it('展示首发版本的实际运行方式与数据位置', () => {
    render(<HelpPanel />);

    expect(screen.getByText('LogLayer 使用手册')).toBeTruthy();
    expect(screen.getByText('LogLayer v0.1.0 · 首个公开版本 · 本地服务模式')).toBeTruthy();
    expect(screen.getByText(/\.loglayer\/workspace\.db/)).toBeTruthy();
    expect(screen.getByText(/\.loglayer\/cache\.db/)).toBeTruthy();
    expect(screen.getByText(/当前版本不会自动重新索引文件内容/)).toBeTruthy();
    expect(screen.getByText(/服务与 API/)).toBeTruthy();
  });
});
