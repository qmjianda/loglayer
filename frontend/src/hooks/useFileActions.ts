/**
 * useFileActions - 文件操作编排钩子（refactor-app-orchestration）。
 *
 * 承载 App.tsx 中可复用的文件打开/激活编排逻辑：
 * - openFileInEditor: 统一打开文件入口（已打开则激活面板，否则经 dockview addPanel）
 * - handleFileActivateWithLoad: 激活文件并确保后端同步
 * - handleOpenFolder: 统一打开文件夹编排（原生对话框 / 远程选择器分流）
 *
 * 跨组件依赖（dock 实例、文件列表、激活回调、远程选择器等）作为参数传入，
 * 保持纯编排职责，与 useFileManagement（状态管理）分离。
 */
import { useCallback } from 'react';
import { DockviewApi } from 'dockview-react';
import { hasNativeDialogs } from '../bridge_client';
import { basename, panelIdForFile } from '../utils';
import type { FileData } from './useFileManagement';

interface UseFileActionsDeps {
  dockApiRef: React.MutableRefObject<DockviewApi | null>;
  files: FileData[];
  handleFileActivate: (fileId: string) => void;
  handleNativeFolderSelect: () => Promise<{ path: string; name: string } | null>;
  setWorkspaceRoot: (root: { path: string; name: string } | null) => void;
  openRemotePicker: (callback: (result: { path: string; isDir: boolean }) => void) => void;
  handleOpenFileByPath: (path: string, name: string) => void;
}

export const useFileActions = ({
  dockApiRef,
  files,
  handleFileActivate,
  handleNativeFolderSelect,
  setWorkspaceRoot,
  openRemotePicker,
  handleOpenFileByPath,
}: UseFileActionsDeps) => {
  // 统一打开文件入口：已打开则激活面板，否则 addPanel（经 dockview API）
  const openFileInEditor = useCallback(
    (fileId: string) => {
      const api = dockApiRef.current;
      if (!api) return;

      const file = files.find((f) => f.id === fileId);
      const panelId = panelIdForFile(file?.path);
      const existing = api.panels.find(
        (p) =>
          p.id === panelId ||
          p.params?.fileId === fileId ||
          (file?.path && p.params?.uri === file.path),
      );
      if (existing) {
        existing.api.setActive();
      } else {
        api.addPanel({
          id: panelId,
          component: 'logViewer',
          title: file?.name || fileId,
          params: { fileId, uri: file?.path },
        });
      }
      handleFileActivate(fileId);
    },
    [files, handleFileActivate, dockApiRef],
  );

  // 增强版：激活文件，并确保其在后端也处于同步状态
  const handleFileActivateWithLoad = useCallback(
    (fileId: string) => {
      openFileInEditor(fileId);
    },
    [openFileInEditor],
  );

  // 统一"打开文件夹"编排：原生对话框可用走原生选择，否则回退到远程路径选择器（--no-ui 模式）
  const handleOpenFolder = useCallback(async () => {
    if (await hasNativeDialogs()) {
      const result = await handleNativeFolderSelect();
      if (result) {
        setWorkspaceRoot(result);
      }
      return;
    }
    openRemotePicker(({ path, isDir }) => {
      if (isDir) {
        const folderName = basename(path);
        setWorkspaceRoot({ path, name: folderName });
      } else {
        // 如果是文件，直接打开
        const fileName = basename(path);
        handleOpenFileByPath(path, fileName);
      }
    });
  }, [handleNativeFolderSelect, setWorkspaceRoot, openRemotePicker, handleOpenFileByPath]);

  return { openFileInEditor, handleFileActivateWithLoad, handleOpenFolder };
};
