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

export interface UseWorkspaceConfigReturn {
  saveConfig: () => Promise<boolean>;
  loadConfig: () => Promise<boolean>;
  /** 从 kv['layout'] 加载的 dockview 布局 JSON；随工作区切换而变化 */
  layout: string | null;
  /** 写回 kv['layout']（防抖在 EditorArea 内部完成） */
  saveLayout: (json: string) => void;
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
  const [layout, setLayout] = useState<string | null>(null);

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

    isLoadingRef.current = true;
    try {
      // 布局独立于文件历史加载：即使无文件也恢复分屏结构
      const savedLayout = await getWorkspaceState('layout', configPath);
      setLayout(savedLayout);

      const config = await loadWorkspaceConfig(configPath);
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

        // 仅自动打开 wasOpen=true 的文件；wasOpen=false 的历史文件只进列表
        newFiles.forEach((f) => {
          if (f.wasOpen && f.path) {
            openFile(f.id, f.path).then((ok) => {
              // 打开失败（如路径不存在）：降级为历史文件，避免永久 loading
              if (!ok) {
                setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, wasOpen: false } : x)));
              }
            });
          }
        });

        // Restore active file（仅限仍打开的文件）
        const activeAbs = config.activeFilePath ? resolvePath(config.activeFilePath) : null;
        if (activeAbs) {
          const found = newFiles.find((f) => f.path === activeAbs && f.wasOpen);
          if (found) {
            setTimeout(() => setActiveFileId(found.id), 100);
          } else {
            const firstOpen = newFiles.find((f) => f.wasOpen);
            if (firstOpen) setTimeout(() => setActiveFileId(firstOpen.id), 100);
          }
        } else {
          const firstOpen = newFiles.find((f) => f.wasOpen);
          if (firstOpen) setTimeout(() => setActiveFileId(firstOpen.id), 100);
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
      // Always reload config when workspace changes (user explicitly switched folders)
      loadConfig().then((success) => {
        if (!success) {
          // No config found, clear current session
          setFiles([]);
          setActiveFileId(null);
          console.log('[WorkspaceConfig] No config found for new workspace, cleared session');
        }
      });
    } else {
      // 工作区关闭：清空已加载布局，避免旧布局串到下一工作区
      setLayout(null);
    }
  }, [workspaceRoot?.path]); // Only triggers on root change

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

  return { saveConfig, loadConfig, layout, saveLayout };
}
