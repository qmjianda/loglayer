import { useMemo } from 'react';
import { LayerType } from '../types';
import { MAX_PANES } from '../hooks/usePaneManagement';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  action: () => void;
  enabled?: boolean;
}

interface UseAppCommandsParams {
  handleOpen: () => void;
  handleNativeFolderSelect: () => Promise<unknown>;
  setIsFindVisible: (visible: boolean) => void;
  findNextSearchMatchWithJump: (direction: 'next' | 'prev') => Promise<void>;
  setIsGoToLineVisible: (visible: boolean) => void;
  setActiveView: (view: 'main' | 'ai' | 'stats' | 'help') => void;
  splitPane: (paneId: string, fileId?: string, direction?: 'right' | 'bottom') => void;
  removePane: (paneId: string) => void;
  addLayer: (type: LayerType, config?: unknown) => void;
  setIsSettingsVisible: (visible: boolean) => void;
  setIsExportDialogOpen: (visible: boolean) => void;
  setIsStorageSettingsOpen: (visible: boolean) => void;
  setIsWorkerConfigOpen: (visible: boolean) => void;
  setIsPluginManagerOpen: (visible: boolean) => void;
  activePaneId: string;
  panes: Array<{ id: string }>;
  activeFileId: string | null;
  bookmarks: Record<string, Record<number, string>>;
  activeFileName?: string;
}

export const useAppCommands = ({
  handleOpen,
  handleNativeFolderSelect,
  setIsFindVisible,
  findNextSearchMatchWithJump,
  setIsGoToLineVisible,
  setActiveView,
  splitPane,
  removePane,
  addLayer,
  setIsSettingsVisible,
  setIsExportDialogOpen,
  setIsStorageSettingsOpen,
  setIsWorkerConfigOpen,
  setIsPluginManagerOpen,
  activePaneId,
  panes,
  activeFileId,
  bookmarks,
  activeFileName
}) => {
  const commands: Command[] = useMemo(() => [
    { id: 'file.open', label: '打开文件', shortcut: 'Ctrl+O', category: '文件', action: handleOpen },
    { id: 'file.openFolder', label: '打开文件夹', shortcut: 'Ctrl+Shift+O', category: '文件', action: handleNativeFolderSelect },
    { id: 'search.focus', label: '聚焦搜索', shortcut: 'Ctrl+F', category: '搜索', action: () => setIsFindVisible(true) },
    { id: 'search.next', label: '下一个匹配', shortcut: 'F3', category: '搜索', action: () => findNextSearchMatchWithJump('next') },
    { id: 'search.prev', label: '上一个匹配', shortcut: 'Shift+F3', category: '搜索', action: () => findNextSearchMatchWithJump('prev') },
    { id: 'goto.line', label: '跳转到行', shortcut: 'Ctrl+G', category: '导航', action: () => setIsGoToLineVisible(true) },
    { id: 'view.main', label: '主视图', category: '视图', action: () => setActiveView('main') },
    { id: 'view.ai', label: 'AI 助手', category: '视图', action: () => setActiveView('ai') },
    { id: 'view.stats', label: '统计面板', category: '视图', action: () => setActiveView('stats') },
    { id: 'view.help', label: '帮助视图', category: '视图', action: () => setActiveView('help') },
    { 
      id: 'pane.splitRight', 
      label: '向右分屏', 
      shortcut: 'Ctrl+\\ | Ctrl+Shift+→', 
      category: '分屏', 
      action: () => splitPane(activePaneId, undefined, 'right'), 
      enabled: panes.length < MAX_PANES 
    },
    { 
      id: 'pane.splitBottom', 
      label: '向下分屏', 
      shortcut: 'Ctrl+Shift+\\ | Ctrl+Shift+↓', 
      category: '分屏', 
      action: () => splitPane(activePaneId, undefined, 'bottom'), 
      enabled: panes.length < MAX_PANES 
    },
    { 
      id: 'pane.close', 
      label: '关闭当前分屏', 
      shortcut: 'Ctrl+W', 
      category: '分屏', 
      action: () => removePane(activePaneId), 
      enabled: panes.length > 1 
    },
    { 
      id: 'layer.new', 
      label: '新建图层', 
      shortcut: 'Ctrl+Shift+L', 
      category: '图层', 
      action: () => addLayer(LayerType.HIGHLIGHT, { query: '', color: '#fbbf24', enabled: true })
    },
    { 
      id: 'bookmark.export', 
      label: '导出书签', 
      category: '书签', 
      action: () => {
        if (activeFileId && bookmarks[activeFileId]) {
          const fileBookmarks = bookmarks[activeFileId];
          const exportData = {
            file: activeFileName,
            exportedAt: new Date().toISOString(),
            bookmarks: Object.entries(fileBookmarks).map(([line, comment]) => ({
              line: parseInt(line),
              comment
            }))
          };
          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${activeFileName || 'bookmarks'}_bookmarks.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    },
    { id: 'settings.open', label: '打开设置', shortcut: 'Ctrl+,', category: '设置', action: () => setIsSettingsVisible(true) },
    { id: 'export.open', label: '导出日志', category: '工具', action: () => setIsExportDialogOpen(true), enabled: !!activeFileId },
    { id: 'storage.open', label: '存储设置', category: '工具', action: () => setIsStorageSettingsOpen(true) },
    { id: 'worker.open', label: 'Worker 配置', category: '工具', action: () => setIsWorkerConfigOpen(true) },
    { id: 'plugin.open', label: '插件管理', category: '工具', action: () => setIsPluginManagerOpen(true) },
  ], [
    handleOpen, handleNativeFolderSelect, setIsFindVisible, 
    findNextSearchMatchWithJump, setIsGoToLineVisible, 
    setActiveView, splitPane, removePane, addLayer, 
    setIsSettingsVisible, setIsExportDialogOpen, setIsStorageSettingsOpen,
    setIsWorkerConfigOpen, setIsPluginManagerOpen,
    activePaneId, panes, activeFileId, 
    bookmarks, activeFileName
  ]);

  return commands;
};
