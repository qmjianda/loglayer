/**
 * EditorArea - dockview 容器组件
 *
 * 承载 DockviewReact，注册 `logViewer` 面板组件渲染现有 LogViewer，
 * 负责布局持久化（fromJSON/toJSON）、激活面板驱动与面板关闭事件回调。
 */

import React, { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  DockviewReact,
  DockviewReadyEvent,
  DockviewApi,
  IDockviewPanelProps,
  IWatermarkPanelProps,
} from 'dockview-react';
import 'dockview/dist/styles/dockview.css';
import { LogViewer } from './LogViewer';
import { EditorFindWidget } from './EditorFindWidget';
import { FileLoadingSkeleton, IndexingOverlay, PendingFilesWall } from './LoadingOverlays';
import { FileData, ProcessedCache } from '../hooks/useFileManagement';
import { SearchConfig } from '../hooks/useSearch';
import { AppSettings } from '../hooks/useSettings';
import { LayerType } from '../types';
import { panelIdForFile } from '../utils';
import { useSearchStore } from '../store/searchStore';

const SAVE_DELAY_MS = 500;

interface LogViewerPanelParams {
  fileId: string;
  uri?: string;
  /** dockview 面板 id（`log-view-<hash>`），作为 per-tab 搜索状态的 key */
  panelId?: string;
}

// 面板组件可访问的实时数据（经 Context 注入）
interface EditorAreaData {
  files: FileData[];
  activeFileId: string | null;
  loadingFileIds: Set<string>;
  indexingFileIds: Set<string>;
  /** 当前索引进度（0-100，operationProgress op='indexing' 驱动），传给 IndexingOverlay */
  indexingProgress?: number;
  pendingCliFiles: number;
  processedCache: Record<string, ProcessedCache>;
  bridgedUpdateTrigger: number;
  searchQuery: string;
  searchConfig: SearchConfig;
  activeView: string;
  scrollToIndex: number | null;
  highlightedIndex: number | null;
  settings: AppSettings;
  resolvedTheme: 'dark' | 'light';
  hasNewContent: boolean;
  /** 当前激活文件的书签（视觉行号 → 注释），供前端渲染书签样式（2.8 数据/视觉分离） */
  bookmarks: Record<number, string>;
  onOpen: () => void;
  onLineClick: (idx: number) => void;
  onAddLayer: (type: LayerType, config?: any) => void;
  onToggleBookmark: (lineIndex: number) => void;
  onUpdateBookmarkComment: (lineIndex: number, comment: string) => void;
  onSelectedTextChange: (text: string) => void;
  onScrollToNewContent: () => void;
  /** find widget 导航回调（App 级 findNextSearchMatch，走 activePanelId，仅激活面板触发） */
  onFindNavigate: (direction: 'next' | 'prev') => void;
}

const EditorAreaContext = React.createContext<EditorAreaData | null>(null);

function resolveFile(
  files: FileData[],
  params: LogViewerPanelParams | undefined,
): FileData | undefined {
  if (!params) return undefined;
  if (params.fileId) {
    const byId = files.find((f) => f.id === params.fileId);
    if (byId) return byId;
  }
  if (params.uri) {
    return files.find((f) => f.path === params.uri);
  }
  return undefined;
}

// dockview `logViewer` 面板组件：经 params.fileId / params.uri 渲染现有 LogViewer
const LogViewerPanel: React.FC<IDockviewPanelProps<LogViewerPanelParams>> = ({ params }) => {
  const data = useContext(EditorAreaContext);
  const file = resolveFile(data?.files || [], params);
  const panelId = params.panelId ?? '';

  // per-tab 搜索状态：本面板自己的 tab（widget 与高亮均按此渲染，不串用激活面板的词）
  const tab = useSearchStore((s) => (panelId ? s.tabs[panelId] : null));
  const activePanelId = useSearchStore((s) => s.activePanelId);
  const isPanelActive = panelId !== '' && panelId === activePanelId;
  const setQuery = useSearchStore((s) => s.setQuery);
  const setConfig = useSearchStore((s) => s.setConfig);
  const setFindVisible = useSearchStore((s) => s.setFindVisible);
  const ensureTab = useSearchStore((s) => s.ensureTab);

  useEffect(() => {
    if (panelId) ensureTab(panelId);
  }, [panelId, ensureTab]);

  // 文件尚未加载完成（可能刚被加入列表）
  if (data && file) {
    const fileId = file.id;
    const isLoading = data.loadingFileIds.has(fileId) || data.indexingFileIds.has(fileId);
    const isActive = data.activeFileId === fileId;
    const searchQuery = tab?.query ?? '';
    const searchConfig = tab?.config ?? {
      regex: false,
      caseSensitive: false,
      wholeWord: false,
      mode: 'highlight' as const,
    };
    const matchCount = data.processedCache[fileId]?.searchMatchCount ?? 0;
    const currentMatchNumber = tab && tab.currentMatchRank >= 0 ? tab.currentMatchRank + 1 : 0;

    if (isLoading) {
      return (
        <div className="relative h-full w-full overflow-hidden">
          <FileLoadingSkeleton fileName={file.name} />
          {/* 索引中：在骨架屏之上叠加进度环（z-50 > FileLoadingSkeleton z-40），fileLoaded 后整体消失 */}
          {data.indexingFileIds.has(fileId) && (
            <IndexingOverlay progress={data.indexingProgress ?? 0} fileName={file.name} />
          )}
        </div>
      );
    }

    return (
      <div
        data-find-widget-host="true"
        className="h-full w-full flex flex-col relative min-h-0 overflow-hidden"
      >
        <LogViewer
          key={params.uri || fileId}
          totalLines={file.lineCount}
          fileId={fileId}
          scrollKey={params.uri || fileId}
          layers={file.layers || []}
          bookmarks={isActive ? data.bookmarks : {}}
          searchQuery={searchQuery}
          searchConfig={searchConfig}
          scrollToIndex={isActive ? data.scrollToIndex : null}
          highlightedIndex={isActive ? data.highlightedIndex : null}
          onLineClick={data.onLineClick}
          onAddLayer={data.onAddLayer}
          onToggleBookmark={data.onToggleBookmark}
          onUpdateBookmarkComment={data.onUpdateBookmarkComment}
          onSelectedTextChange={data.onSelectedTextChange}
          updateTrigger={data.bridgedUpdateTrigger}
          settings={data.settings}
          resolvedTheme={data.resolvedTheme}
          rawLineCount={file.rawCount}
          showVirtualLineNumbers={data.settings.showVirtualLineNumbers}
          hasNewContent={data.hasNewContent}
          onScrollToNewContent={data.onScrollToNewContent}
        />

        {/* 每面板独立 find widget：读本面板 tab 状态，定位面板右上角 */}
        {tab?.isFindVisible && (
          <EditorFindWidget
            panelId={panelId}
            isActive={isPanelActive}
            focusRequest={tab.focusRequest ?? 0}
            query={searchQuery}
            onQueryChange={(q) => setQuery(panelId, q)}
            config={searchConfig}
            onConfigChange={(updater) => {
              const next = typeof updater === 'function' ? updater(searchConfig) : updater;
              setConfig(panelId, next);
            }}
            matchCount={matchCount}
            currentMatch={currentMatchNumber}
            onNavigate={data.onFindNavigate}
            onClose={() => setFindVisible(panelId, false)}
            searchMode={searchConfig.mode}
            onSearchModeChange={(mode) => setConfig(panelId, { mode })}
          />
        )}
      </div>
    );
  }

  return null;
};

// 空面板兜底：无已打开面板时显示默认空编辑器占位
const WelcomeWatermark: React.FC<IWatermarkPanelProps> = () => {
  const data = useContext(EditorAreaContext);
  if (!data) return null;

  if (data.pendingCliFiles > 0) {
    return <PendingFilesWall count={data.pendingCliFiles} />;
  }

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center text-gray-600 bg-theme-base cursor-pointer hover:bg-theme-surface transition-colors"
      onClick={data.onOpen}
    >
      <svg
        className="w-12 h-12 mb-4 opacity-20"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeWidth="1"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="text-sm font-medium">将日志文件拖拽至此处打开</p>
      <p className="text-[10px] mt-2 opacity-50">或点击浏览并打开文件/文件夹</p>
    </div>
  );
};

export interface EditorAreaProps extends EditorAreaData {
  onFileActivated: (fileId: string | null) => void;
  onFileClosed: (fileId: string) => void;
  onApiReady: (api: DockviewApi) => void;
  onFileDrop: (paths: { name: string; path: string }[]) => void;
  /** 已保存的布局 JSON（来自 kv['layout']）；为空时不恢复 */
  initialLayout?: string | null;
  /** 布局变化回调（防抖后调用），由上层写回 kv['layout'] */
  onLayoutChange?: (json: string) => void;
}

// 旧布局面板 id 为 `log-<fileId>`（fileId 每次会话变化，刷新后对不上）。
// dockview 序列化格式：`panels` 是按 id 索引的对象，`grid` 叶子节点通过
// `data.views` 引用面板 id。恢复前将两者中旧 id 重映射为基于路径的稳定 id。
// 兼容旧的 localStorage 布局数据（解析自外部 JSON）。
interface DockviewPanelMeta {
  id?: string;
  params?: { uri?: string };
}

function remapPanelIds(json: any): any {
  const panels = json?.panels as Record<string, DockviewPanelMeta> | undefined;
  if (!panels) return json;

  const oldToNew = new Map<string, string>();
  for (const [id, panel] of Object.entries(panels)) {
    if (id.startsWith('log-') && !id.startsWith('log-view-')) {
      const uri = panel.params?.uri;
      if (uri) oldToNew.set(id, panelIdForFile(uri));
    }
  }
  if (oldToNew.size === 0) return json;

  for (const [oldId, newId] of oldToNew) {
    const panel = panels[oldId];
    panel.id = newId;
    panels[newId] = panel;
    delete panels[oldId];
  }
  remapGridPanelIds(json.grid?.root, oldToNew);
  return json;
}

function remapGridPanelIds(grid: any, oldToNew: Map<string, string>): void {
  if (!grid || typeof grid !== 'object') return;
  if (Array.isArray(grid.data)) {
    grid.data.forEach((child: any) => remapGridPanelIds(child, oldToNew));
    return;
  }
  if (Array.isArray(grid.data?.views)) {
    grid.data.views = grid.data.views.map((id: string) => oldToNew.get(id) ?? id);
    if (typeof grid.data.activeView === 'string') {
      grid.data.activeView = oldToNew.get(grid.data.activeView) ?? grid.data.activeView;
    }
  }
}

export const EditorArea: React.FC<EditorAreaProps> = (props) => {
  const apiRef = useRef<DockviewApi | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  // 最近一次 fromJSON 应用的布局；防止同一布局重复回放（onReady 与异步加载双触发）
  const lastAppliedLayoutRef = useRef<string | null>(null);

  // 布局持久化：防抖保存（经 onLayoutChange 回传给上层写 kv['layout']，不再用 localStorage）
  const saveLayout = useCallback((api: DockviewApi) => {
    try {
      const json = JSON.stringify(api.toJSON());
      propsRef.current.onLayoutChange?.(json);
    } catch (e) {
      console.error('[EditorArea] Failed to save layout:', e);
    }
  }, []);

  // 恢复布局：fromJSON 前按 params.uri 重映射旧 view id（兼容旧布局数据）
  const applySavedLayout = useCallback(
    (api: DockviewApi, layoutJson: string | null | undefined): boolean => {
      if (!layoutJson) return false;
      try {
        const json = remapPanelIds(JSON.parse(layoutJson));
        api.fromJSON(json);
        lastAppliedLayoutRef.current = layoutJson;
        return true;
      } catch (e) {
        console.error('[EditorArea] Failed to restore layout:', e);
        return false;
      }
    },
    [],
  );

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      apiRef.current = api;
      props.onApiReady(api);

      // 恢复布局；失败或尚无保存布局则按当前打开文件添加默认面板
      const restored = applySavedLayout(api, propsRef.current.initialLayout);

      // 兜底：确保所有当前打开文件（wasOpen）都有面板（restore 失败或 restore 前的文件）
      if (!restored) {
        propsRef.current.files
          .filter((f) => f.wasOpen !== false)
          .forEach((file) => {
            const panelId = panelIdForFile(file.path);
            if (!api.getPanel(panelId)) {
              api.addPanel({
                id: panelId,
                component: 'logViewer',
                title: file.name,
                params: { fileId: file.id, uri: file.path, panelId },
                inactive: true,
              });
            }
          });
      }

      // 激活面板变化 → 通知外部更新 activeFileId，并同步 per-tab 搜索激活面板
      api.onDidActivePanelChange((e) => {
        const file = resolveFile(
          propsRef.current.files,
          e.panel?.params as LogViewerPanelParams | undefined,
        );
        propsRef.current.onFileActivated(file?.id ?? null);

        // 防御：布局恢复/切组可能短暂无活动面板
        useSearchStore.getState().setActivePanel(e.panel?.id ?? null);
      });

      // 面板关闭 → 若无其他面板引用同一文件，则释放会话
      api.onDidRemovePanel((panel) => {
        // per-tab 搜索状态随面板生命周期销毁
        if (panel.id) {
          useSearchStore.getState().destroyTab(panel.id);
        }
        const fileId = panel.params?.fileId as string | undefined;
        const uri = panel.params?.uri as string | undefined;
        if (!fileId && !uri) return;
        const stillReferenced = api.panels.some(
          (p) =>
            (p.params?.fileId && p.params.fileId === fileId) ||
            (p.params?.uri && p.params.uri === uri),
        );
        if (!stillReferenced) {
          const file = resolveFile(
            propsRef.current.files,
            panel.params as LogViewerPanelParams | undefined,
          );
          propsRef.current.onFileClosed(file?.id ?? fileId ?? '');
        }
      });

      // 布局变化 → 防抖保存
      let timer: ReturnType<typeof setTimeout> | null = null;
      const save = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => saveLayout(api), SAVE_DELAY_MS);
      };
      api.onDidLayoutChange(save);
    },
    [applySavedLayout, saveLayout, props],
  );

  // 布局异步到达时恢复（workspace 切换后从 kv['layout'] 加载，晚于 onReady）
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !props.initialLayout) return;
    // 同一布局已应用过则跳过（onReady 已恢复 / 布局内容未变）
    if (props.initialLayout === lastAppliedLayoutRef.current) return;
    applySavedLayout(api, props.initialLayout);
  }, [props.initialLayout, applySavedLayout]);

  // 文件列表变化时：确保每个打开文件都有对应面板，并关闭已移除/已关闭文件的面板
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    // 仅 wasOpen 的文件才有编辑器面板（历史文件不自动打开）
    const openFiles = props.files.filter((f) => f.wasOpen !== false);
    const knownIds = new Set(openFiles.map((f) => f.id));
    const knownUris = new Set(openFiles.map((f) => f.path).filter(Boolean));

    // 文件列表尚未加载（如刷新后 workspace config 异步恢复中）时，
    // 不清理任何面板，避免删除 fromJSON 刚恢复的布局。
    if (openFiles.length === 0) return;

    for (const panel of [...api.panels]) {
      const fid = panel.params?.fileId;
      const uri = panel.params?.uri;
      const matchesFile = (fid && knownIds.has(fid)) || (uri && knownUris.has(uri));
      if (!matchesFile) {
        api.removePanel(panel);
      }
    }

    for (const file of openFiles) {
      const panelId = panelIdForFile(file.path);
      const exists = api.panels.some(
        (p) =>
          p.id === panelId ||
          p.params?.fileId === file.id ||
          (file.path && p.params?.uri === file.path),
      );
      if (!exists) {
        api.addPanel({
          id: panelId,
          component: 'logViewer',
          title: file.name,
          params: { fileId: file.id, uri: file.path, panelId },
          inactive: true,
        });
      }
    }
  }, [props.files]);

  // 激活文件变化 → 激活对应面板
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !props.activeFileId) return;
    const file = props.files.find((f) => f.id === props.activeFileId);
    if (!file) return;
    const panel = api.panels.find(
      (p) => p.params?.fileId === props.activeFileId || (file.path && p.params?.uri === file.path),
    );
    if (panel) {
      panel.api.setActive();
    }
  }, [props.activeFileId, props.files]);

  const contextValue = useMemo<EditorAreaData>(
    () => ({
      files: props.files,
      activeFileId: props.activeFileId,
      loadingFileIds: props.loadingFileIds,
      indexingFileIds: props.indexingFileIds,
      indexingProgress: props.indexingProgress,
      pendingCliFiles: props.pendingCliFiles,
      processedCache: props.processedCache,
      bridgedUpdateTrigger: props.bridgedUpdateTrigger,
      searchQuery: props.searchQuery,
      searchConfig: props.searchConfig,
      activeView: props.activeView,
      scrollToIndex: props.scrollToIndex,
      highlightedIndex: props.highlightedIndex,
      settings: props.settings,
      resolvedTheme: props.resolvedTheme,
      hasNewContent: props.hasNewContent,
      bookmarks: props.bookmarks,
      onOpen: props.onOpen,
      onLineClick: props.onLineClick,
      onAddLayer: props.onAddLayer,
      onToggleBookmark: props.onToggleBookmark,
      onUpdateBookmarkComment: props.onUpdateBookmarkComment,
      onSelectedTextChange: props.onSelectedTextChange,
      onScrollToNewContent: props.onScrollToNewContent,
      onFindNavigate: props.onFindNavigate,
    }),
    [
      props.files,
      props.activeFileId,
      props.loadingFileIds,
      props.indexingFileIds,
      props.indexingProgress,
      props.pendingCliFiles,
      props.processedCache,
      props.bridgedUpdateTrigger,
      props.searchQuery,
      props.searchConfig,
      props.activeView,
      props.scrollToIndex,
      props.highlightedIndex,
      props.settings,
      props.resolvedTheme,
      props.hasNewContent,
      props.bookmarks,
      props.onOpen,
      props.onLineClick,
      props.onAddLayer,
      props.onToggleBookmark,
      props.onUpdateBookmarkComment,
      props.onSelectedTextChange,
      props.onScrollToNewContent,
      props.onFindNavigate,
    ],
  );

  const themeClass =
    props.resolvedTheme === 'light' ? 'dockview-theme-light' : 'dockview-theme-dark';

  // 拖放打开文件：读取 dataTransfer.files 的 path，交给外部统一打开
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const raw = Array.from(e.dataTransfer.files || []) as any[];
    const paths = raw.filter((f: any) => f.path).map((f: any) => ({ name: f.name, path: f.path }));
    if (paths.length > 0) {
      propsRef.current.onFileDrop(paths);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <EditorAreaContext.Provider value={contextValue}>
      <div
        className="flex-1 min-w-0 min-h-0 overflow-hidden"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <DockviewReact
          className={`${themeClass} h-full w-full`}
          onReady={onReady}
          components={{ logViewer: LogViewerPanel }}
          watermarkComponent={WelcomeWatermark}
          defaultRenderer="always"
        />
      </div>
    </EditorAreaContext.Provider>
  );
};
