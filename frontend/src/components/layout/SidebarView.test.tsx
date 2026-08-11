/**
 * SidebarView 布局组件验收测试（refactor-app-orchestration 3.1）。
 *
 * 对应 spec: app-orchestration-structure
 * - Requirement 布局 JSX 归属专用组件：布局组件可独立渲染（props 契约接收数据与回调）
 * - Requirement App.tsx 编排层瘦身：行为保持不变（回归由既有 e2e 承担）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SidebarView } from './SidebarView';

afterEach(cleanup);

const baseProps = {
  activeView: 'main' as const,
  setActiveView: vi.fn(),
  sidebarWidth: 288,
  setSidebarWidth: vi.fn(),
  isMobile: false,
  workspaceRoot: null,
  files: [],
  activeFileId: null,
  activeFile: undefined,
  searchConfig: { regex: false, caseSensitive: false, wholeWord: false },
  setSearchConfig: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  searchMatchCount: 0,
  currentMatchNumber: 0,
  aiPanelInitialContent: '',
  isWatching: false,
  hasNewContent: false,
  onToggleWatch: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenFileByPath: vi.fn(),
  onOpen: vi.fn(),
  onFileActivate: vi.fn(),
  onFileRemove: vi.fn(),
  onFindNavigate: vi.fn(),
  onJumpToLine: vi.fn(),
  onJumpToRank: vi.fn(async () => -1),
  onApplySuggestion: vi.fn(),
  onCloseAI: vi.fn(),
};

describe('SidebarView 布局组件（3.1）', () => {
  it('给定 props 可挂载渲染，不抛出异常', () => {
    expect(() => render(<SidebarView {...baseProps} />)).not.toThrow();
  });

  it('无活动文件时仍渲染侧栏按钮列', () => {
    const { container } = render(<SidebarView {...baseProps} />);
    // Sidebar 按钮列存在（flex 布局根节点非空）
    expect(container.firstChild).toBeTruthy();
  });

  it('main 视图渲染侧栏面板容器', () => {
    const { container } = render(<SidebarView {...baseProps} />);
    // 面板容器 div（含 border-r 类）存在
    const panel = container.querySelector('[class*="border-r"]');
    expect(panel).toBeTruthy();
  });
});
