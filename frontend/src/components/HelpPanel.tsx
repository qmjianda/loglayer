import React from 'react';
import { useShortcutDefinitions, SHORTCUT_REGISTRY } from '../shortcuts';

const displayShortcuts = [
  { id: 'openFile', label: '打开文件' },
  { id: 'openFolder', label: '打开文件夹' },
  { id: 'find', label: '查找' },
  { id: 'gotoLine', label: '跳转到行' },
  { id: 'findNext', label: '下一个匹配' },
  { id: 'findPrev', label: '上一个匹配' },
  { id: 'nextBookmark', label: '下一个书签' },
  { id: 'prevBookmark', label: '上一个书签' },
  { id: 'newLayer', label: '新建图层' },
  { id: 'openSettings', label: '打开设置' },
  { id: 'splitPaneRight', label: '向右分屏' },
  { id: 'closePane', label: '关闭分屏' },
  { id: 'toggleWatch', label: '实时监视' },
  { id: 'commandPalette', label: '命令面板' },
] as const;

export const HelpPanel: React.FC = () => {
  const { platform } = useShortcutDefinitions();

  const formatKey = (key: string): string => {
    if (platform === 'mac') {
      return key
        .replace(/Ctrl/g, '⌘')
        .replace(/Shift/g, '⇧')
        .replace(/Alt/g, '⌥');
    }
    return key;
  };

  return (
    <div className="p-6 flex flex-col h-full overflow-y-auto custom-scrollbar bg-theme-surface text-theme-primary select-text">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b border-theme-subtle pb-6">
          <h2 className="text-2xl font-bold text-theme-primary mb-2 flex items-center gap-3">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            LogLayer 帮助中心
          </h2>
          <p className="text-sm text-theme-muted">
            高性能日志分析工具 · 支持 GB 级文件 · 60FPS 流畅体验
          </p>
        </header>

        <section>
          <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wide">快速开始</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-theme-elevated border border-theme-subtle">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
                <span className="font-medium">打开文件</span>
              </div>
              <p className="text-xs text-theme-muted">
                拖放日志文件到窗口，或使用 <kbd className="px-1.5 py-0.5 bg-theme-surface rounded text-[10px] font-mono">{formatKey(SHORTCUT_REGISTRY.openFile.keys[0])}</kbd> 打开文件选择器
              </p>
            </div>
            <div className="p-4 rounded-lg bg-theme-elevated border border-theme-subtle">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">2</span>
                <span className="font-medium">创建图层</span>
              </div>
              <p className="text-xs text-theme-muted">
                使用 FILTER 过滤关键行，HIGHLIGHT 高亮关键词，实时分析日志
              </p>
            </div>
            <div className="p-4 rounded-lg bg-theme-elevated border border-theme-subtle">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded bg-yellow-500/20 text-yellow-400 flex items-center justify-center text-xs font-bold">3</span>
                <span className="font-medium">书签标注</span>
              </div>
              <p className="text-xs text-theme-muted">
                点击行号添加书签，按 <kbd className="px-1.5 py-0.5 bg-theme-surface rounded text-[10px] font-mono">{formatKey(SHORTCUT_REGISTRY.nextBookmark.keys[0])}</kbd> 快速跳转
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wide">图层系统</h3>
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-theme-elevated border border-theme-subtle">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <div>
                  <span className="font-medium">FILTER</span>
                  <span className="text-xs text-theme-muted ml-2">过滤图层</span>
                </div>
              </div>
              <p className="text-xs text-theme-muted">只显示匹配的行，支持正则表达式。多图层叠加时按顺序依次过滤。</p>
            </div>
            <div className="p-4 rounded-lg bg-theme-elevated border border-theme-subtle">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <span className="font-medium">HIGHLIGHT</span>
                  <span className="text-xs text-theme-muted ml-2">高亮图层</span>
                </div>
              </div>
              <p className="text-xs text-theme-muted">用指定颜色标记匹配的行，不影响其他行显示。适合标记关键信息。</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wide">快捷键</h3>
          <div className="grid grid-cols-2 gap-2">
            {displayShortcuts.map(({ id, label }) => {
              const shortcut = SHORTCUT_REGISTRY[id];
              return (
                <div key={id} className="flex items-center justify-between p-2 rounded bg-theme-elevated border border-theme-subtle">
                  <span className="text-xs text-theme-muted">{label}</span>
                  <kbd className="px-2 py-1 text-[10px] font-mono bg-theme-surface rounded text-theme-secondary border border-theme-subtle">
                    {formatKey(shortcut.keys[0])}
                  </kbd>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-theme-secondary mb-4 uppercase tracking-wide">搜索技巧</h3>
          <div className="p-4 rounded-lg bg-theme-elevated border border-theme-subtle space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded shrink-0">正则</span>
              <p className="text-xs text-theme-muted">启用 Regex 模式，使用 <code className="px-1 bg-theme-surface rounded">ERROR|WARN</code> 匹配多个关键词</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded shrink-0">大小写</span>
              <p className="text-xs text-theme-muted">默认不区分大小写，点击 Case 可切换为精确匹配</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-1 rounded shrink-0">全局</span>
              <p className="text-xs text-theme-muted">搜索使用 ripgrep 引擎，GB 级文件也能瞬间完成</p>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-theme-subtle text-center">
          <p className="text-xs text-theme-muted">
            LogLayer v5.1 · 高效日志分析体验
          </p>
        </footer>
      </div>
    </div>
  );
};