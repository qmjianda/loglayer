/**
 * useWorkspaceConfig - Workspace configuration persistence hook
 *
 * Automatically saves session state (files + layers) to workspace folder and
 * loads them when the same workspace is opened again.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  saveWorkspaceConfig,
  loadWorkspaceConfig,
  openFile,
  getWorkspaceState,
  putWorkspaceState,
  WorkspaceConfig,
  WorkspaceConfigFile,
} from '../bridge_client';
import { FileData } from './useFileManagement';

const SAVE_DEBOUNCE_MS = 1000;
const CONFIG_VERSION = 2; // Bumped version for new schema

export interface UseWorkspaceConfigProps {
  workspaceRoot: { path: string; name: string } | null;
  files: FileData[];
  setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
  activeFileId: string | null;
  setActiveFileId: (id: string | null) => void;
  activeFilePath: string | undefined;
  handleFileActivate: (id: string) => void;
}

export type RestoreState = 'pending' | 'ready' | 'empty';

export interface UseWorkspaceConfigReturn {
  saveConfig: () => Promise<boolean>;
  loadConfig: () => Promise<boolean>;
  /** 从 kv['layout'] 加载的 dockview 布局 JSON；随工作区切换而变化 */
  layout: string | null;
  /** 写回 kv['layout']（防抖在 EditorArea 内部完成） */
  saveLayout: (json: string) => void;
  /** 工作区恢复生命周期状态：pending=持久化读取中, ready=恢复完成或有文件, empty=无保存会话 */
  restoreState: RestoreState;
}

export function useWorkspaceConfig({
  workspaceRoot,
  files,
  setFiles,
  activeFileId,
  setActiveFileId,
  activeFilePath,
}: UseWorkspaceConfigProps): UseWorkspaceConfigReturn {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>('');
  const isLoadingRef = useRef<boolean>(false);
  const restoreRequestRef = useRef(0);
  const [layout, setLayout] = useState<string | null>(null);
  const [restoreState, setRestoreState] = useState<RestoreState>(
    workspaceRoot?.path ? 'pending' : 'empty',
  );

  // Determine the config folder path
  const getConfigPath = useCallback((): string | null => {
    // Prefer workspace root if set
    if (workspaceRoot?.path) {
      return workspaceRoot.path;
    }
    // Fallback to active file's parent directory
    if (activeFilePath) {
      const lastSep = Math.max(activeFilePath.lastIndexOf('/'), activeFilePath.lastIndexOf('\\'));
      if (lastSep > 0) {
        return activeFilePath.substring(0, lastSep);
      }
    }
    return null;
  }, [workspaceRoot, activeFilePath]);

  // Generate hash for change detection (includes files AND layers)
  const getSessionHash = useCallback(
    (filesList: FileData[], activePath?: string | null): string => {
      const fileState = filesList.map((f) => ({
        path: f.path,
        wasOpen: f.wasOpen !== false,
        layers: f.layers.map((l) => [l.id, l.type, l.enabled, l.config]),
      }));
      return JSON.stringify([fileState, activePath]);
    },
    [],
  );

  // Save config to workspace
  const saveConfig = useCallback(async (): Promise<boolean> => {
    const configPath = getConfigPath();
    if (!configPath || files.length === 0) return false;

    const currentHash = getSessionHash(files, activeFilePath);
    if (currentHash === lastSavedHashRef.current) {
      return true; // No changes
    }

    const config: WorkspaceConfig = {
      version: CONFIG_VERSION,
      lastModified: new Date().toISOString(),
      files: files.map((f) => ({
        path: f.path || f.name,
        name: f.name,
        size: f.size,
        layers: f.layers,
        wasOpen: f.wasOpen !== false,
      })),
      activeFilePath: activeFilePath || null,
    };

    const success = await saveWorkspaceConfig(configPath, config);
    if (success) {
      lastSavedHashRef.current = currentHash;
      console.log(`[WorkspaceConfig] Saved session: ${files.length} files`);
    }
    return success;
  }, [getConfigPath, files, activeFilePath, getSessionHash]);

  // Load config from workspace
  const loadConfig = useCallback(async (): Promise<boolean> => {
    const configPath = getConfigPath();
    if (!configPath) return false;

    const requestId = restoreRequestRef.current;
    const isCurrentRequest = () => requestId === restoreRequestRef.current;

    isLoadingRef.current = true;
    try {
      // 布局独立于文件历史加载：即使无文件也恢复分屏结构
      const savedLayout = await getWorkspaceState('layout', configPath);
      if (!isCurrentRequest()) return false;
      setLayout(savedLayout);

      const config = await loadWorkspaceConfig(configPath);
      if (!isCurrentRequest()) return false;
      if (!config) return false;

      // Handle new schema (files list)
      if (config.files && config.files.length > 0) {
        console.log(`[WorkspaceConfig] Restoring session: ${config.files.length} files`);

        // 相对路径基于 workspace 根目录解析为绝对路径
        const workspaceRoot = configPath.replace(/[/\\]\.loglayer$/, '');
        const resolvePath = (p: string): string => {
          if (!p) return p;
          if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)) return p; // 已是绝对路径
          // 相对路径 → 拼接 workspace 根
          return `${workspaceRoot}/${p.replace(/\\/g, '/')}`;
        };

        // 按解析后的绝对路径去重（旧配置可能同时存相对+绝对路径）
        const seen = new Set<string>();
        const deduped = (config.files as WorkspaceConfigFile[]).filter((cf) => {
          const abs = resolvePath(cf.path || '');
          if (!abs || seen.has(abs)) return false;
          seen.add(abs);
          return true;
        });

        const newFiles: FileData[] = deduped.map((cf, i) => ({
          id: `bridged-restored-${Date.now()}-${i}`,
          name: cf.name,
          size: cf.size,
          lineCount: 0, // Will update when loaded
          rawCount: 0,
          // Force collapse all layers when loading from config
          layers: (cf.layers || []).map((l) => ({ ...l, isCollapsed: true })),
          isBridged: true,
          path: resolvePath(cf.path || ''),
          wasOpen: cf.wasOpen !== false, // 默认 true（旧配置无该字段视为打开）
          history: { past: [], future: [] },
        }));

        setFiles(newFiles);
        setRestoreState('ready');

        // 仅自动打开 wasOpen=true 的文件；wasOpen=false 的历史文件只进列表
        newFiles.forEach((f) => {
          if (f.wasOpen && f.path) {
            const markRestoreFailure = () => {
              if (!isCurrentRequest()) return;
              setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, wasOpen: false } : x)));
            };
            openFile(f.id, f.path).then((ok) => {
              // 打开失败（如路径不存在）：降级为历史文件，避免永久 loading
              if (!ok) markRestoreFailure();
            }, markRestoreFailure);
          }
        });

        // Restore active file（仅限仍打开的文件）
        const activeAbs = config.activeFilePath ? resolvePath(config.activeFilePath) : null;
        if (activeAbs) {
          const found = newFiles.find((f) => f.path === activeAbs && f.wasOpen);
          if (found) {
            setActiveFileId(found.id);
          } else {
            const firstOpen = newFiles.find((f) => f.wasOpen);
            if (firstOpen) setActiveFileId(firstOpen.id);
          }
        } else {
          const firstOpen = newFiles.find((f) => f.wasOpen);
          if (firstOpen) setActiveFileId(firstOpen.id);
        }

        lastSavedHashRef.current = getSessionHash(newFiles, config.activeFilePath);
        return true;
      }
      // Handle legacy/fallback (global layers) - user for upgrading from v1
      else if (config.layers && config.layers.length > 0) {
        // We don't restore files here, just layers for currently open ones?
        // Actually this case assumes files are already open, which contradicts the
        // requirement to "restore opened files".
        // We'll ignore legacy layer-only restoration for empty sessions.
        console.log(
          '[WorkspaceConfig] Legacy config found, skipping session restore (no files list)',
        );
      }
      return false;
    } finally {
      isLoadingRef.current = false;
    }
  }, [getConfigPath, setFiles, setActiveFileId, getSessionHash]);

  // Auto-load when workspace changes
  useEffect(() => {
    if (workspaceRoot?.path) {
      const requestId = restoreRequestRef.current + 1;
      restoreRequestRef.current = requestId;
      setRestoreState('pending');
      setFiles([]);
      setActiveFileId(null);
      loadConfig()
        .then((success) => {
          if (requestId !== restoreRequestRef.current) return;
          if (!success) {
            setFiles([]);
            setActiveFileId(null);
            setRestoreState('empty');
            console.log('[WorkspaceConfig] No config found for new workspace, cleared session');
          }
        })
        .catch(() => {
          if (requestId !== restoreRequestRef.current) return;
          setFiles([]);
          setActiveFileId(null);
          setRestoreState('empty');
        });
    } else {
      restoreRequestRef.current += 1;
      setLayout(null);
      setFiles([]);
      setActiveFileId(null);
      setRestoreState('empty');
    }
  }, [workspaceRoot?.path]);

  // 布局持久化：EditorArea 防抖后经此写回 kv['layout']
  const saveLayout = useCallback(
    (json: string) => {
      const configPath = getConfigPath();
      if (!configPath) return;
      putWorkspaceState(configPath, 'layout', json);
    },
    [getConfigPath],
  );

  // Auto-save debouncer
  useEffect(() => {
    if (isLoadingRef.current) return;
    if (files.length === 0 && !workspaceRoot) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveConfig();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [files, activeFileId, activeFilePath]); // Triggers on any file/layer change

  return { saveConfig, loadConfig, layout, saveLayout, restoreState };
}
