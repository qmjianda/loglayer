/**
 * useCommands - 命令面板命令定义（refactor-app-orchestration）。
 *
 * 承载 CommandPalette 的命令数组与快捷键监听，从 App.tsx 提取。
 * 依赖（打开/导航/图层/书签/设置回调）作为参数传入。
 */
import { useEffect } from 'react';
import { Command } from '../components/CommandPalette';
import { useSearchStore } from '../store/searchStore';
import { LayerType } from '../types';
import { getRecentColors, RECOMMENDED_COLORS } from '../constants/colors';
import type { FileData } from './useFileManagement';

interface UseCommandsDeps {
  handleOpen: () => void;
  handleNativeFolderSelect: () => Promise<{ path: string; name: string } | null>;
  handleToggleWatch: () => void;
  findNextSearchMatchWithJump: (direction: 'next' | 'prev') => void;
  setIsGoToLineVisible: (v: boolean) => void;
  setActiveView: (v: 'main' | 'search' | 'ai' | 'help') => void;
  setIsCommandPaletteVisible: (v: boolean) => void;
  setIsSettingsVisible: (v: boolean) => void;
  setIsDebugVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  addLayer: (type: LayerType, config: unknown) => void;
  activeFileId: string | null;
  activeFile: FileData | undefined;
  bookmarks: Record<string, Record<number, string>>;
}

export const useCommands = ({
  handleOpen,
  handleNativeFolderSelect,
  handleToggleWatch,
  findNextSearchMatchWithJump,
  setIsGoToLineVisible,
  setActiveView,
  setIsCommandPaletteVisible,
  setIsSettingsVisible,
  setIsDebugVisible,
  addLayer,
  activeFileId,
  activeFile,
  bookmarks,
}: UseCommandsDeps) => {
  const commands: Command[] = [
    {
      id: 'file.open',
      label: '打开文件',
      shortcut: 'Ctrl+O',
      category: '文件',
      action: handleOpen,
    },
    {
      id: 'file.openFolder',
      label: '打开文件夹',
      shortcut: 'Ctrl+Shift+O',
      category: '文件',
      action: handleNativeFolderSelect,
    },
    {
      id: 'search.focus',
      label: '聚焦搜索',
      shortcut: 'Ctrl+F',
      category: '搜索',
      action: () => {
        const panelId = useSearchStore.getState().activePanelId;
        if (panelId) useSearchStore.getState().requestFocus(panelId);
      },
    },
    {
      id: 'search.next',
      label: '下一个匹配',
      shortcut: 'F3',
      category: '搜索',
      action: () => findNextSearchMatchWithJump('next'),
    },
    {
      id: 'search.prev',
      label: '上一个匹配',
      shortcut: 'Shift+F3',
      category: '搜索',
      action: () => findNextSearchMatchWithJump('prev'),
    },
    {
      id: 'goto.line',
      label: '跳转到行',
      shortcut: 'Ctrl+G',
      category: '导航',
      action: () => setIsGoToLineVisible(true),
    },
    { id: 'view.main', label: '主视图', category: '视图', action: () => setActiveView('main') },
    {
      id: 'view.search',
      label: '搜索视图',
      category: '视图',
      action: () => setActiveView('search'),
    },
    { id: 'view.ai', label: 'AI 助手', category: '视图', action: () => setActiveView('ai') },
    { id: 'view.help', label: '帮助视图', category: '视图', action: () => setActiveView('help') },
    {
      id: 'layer.new',
      label: '新建图层',
      shortcut: 'Ctrl+Shift+L',
      category: '图层',
      action: () => {
        addLayer(LayerType.HIGHLIGHT, { query: '', color: '#fbbf24', enabled: true });
      },
    },
    {
      id: 'layer.highlightSelection',
      label: '高亮选中文本',
      shortcut: 'Ctrl+Shift+H',
      category: '图层',
      action: () => {
        const selectedText = window.getSelection()?.toString().trim() ?? '';
        if (!selectedText) return;
        const color = getRecentColors()[0] ?? RECOMMENDED_COLORS[0];
        addLayer(LayerType.HIGHLIGHT, { query: selectedText, color });
      },
    },
    {
      id: 'bookmark.export',
      label: '导出书签',
      category: '书签',
      action: () => {
        // 导出书签为 JSON 文件
        if (activeFileId && bookmarks[activeFileId]) {
          const fileBookmarks = bookmarks[activeFileId];
          const exportData = {
            file: activeFile?.name,
            exportedAt: new Date().toISOString(),
            bookmarks: Object.entries(fileBookmarks).map(([line, comment]) => ({
              line: parseInt(line),
              comment,
            })),
          };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${activeFile?.name || 'bookmarks'}_bookmarks.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      },
    },
    {
      id: 'settings.open',
      label: '打开设置',
      shortcut: 'Ctrl+,',
      category: '设置',
      action: () => setIsSettingsVisible(true),
    },
  ];

  // 命令面板快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isP = e.key.toLowerCase() === 'p';
      const isT = e.key.toLowerCase() === 't';
      const isH = e.key.toLowerCase() === 'h';
      const isComma = e.key === ',';
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Ctrl+Shift+P: 命令面板
      if (isCmdOrCtrl && isP && isShift) {
        e.preventDefault();
        setIsCommandPaletteVisible(true);
      }

      // Ctrl+Shift+H: 高亮选中文本
      if (isCmdOrCtrl && isH && isShift) {
        e.preventDefault();
        const selectedText = window.getSelection()?.toString().trim() ?? '';
        if (selectedText) {
          const color = getRecentColors()[0] ?? RECOMMENDED_COLORS[0];
          addLayer(LayerType.HIGHLIGHT, { query: selectedText, color });
        }
      }

      // Ctrl+Shift+T: 文件监视
      if (isCmdOrCtrl && isT && isShift) {
        e.preventDefault();
        handleToggleWatch();
      }

      // Ctrl+Shift+D: Debug overlay（诊断浮层）
      if (isCmdOrCtrl && e.key.toLowerCase() === 'd' && isShift) {
        e.preventDefault();
        setIsDebugVisible((v) => !v);
      }

      // Ctrl+,: 设置
      if (isCmdOrCtrl && isComma) {
        e.preventDefault();
        setIsSettingsVisible(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleToggleWatch,
    setIsSettingsVisible,
    setIsCommandPaletteVisible,
    setIsDebugVisible,
    addLayer,
  ]);

  return commands;
};
