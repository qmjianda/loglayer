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
    IWatermarkPanelProps
} from 'dockview-react';
import 'dockview/dist/styles/dockview.css';
import { LogViewer } from './LogViewer';
import { FileLoadingSkeleton, PendingFilesWall } from './LoadingOverlays';
import { FileData, ProcessedCache } from '../hooks/useFileManagement';
import { SearchConfig } from '../hooks/useSearch';
import { AppSettings } from '../hooks/useSettings';
import { LayerType } from '../types';

const LAYOUT_STORAGE_KEY = 'loglayer_dockview_layout';
const SAVE_DELAY_MS = 500;

interface LogViewerPanelParams {
    fileId: string;
    uri?: string;
}

// 面板组件可访问的实时数据（经 Context 注入）
interface EditorAreaData {
    files: FileData[];
    activeFileId: string | null;
    loadingFileIds: Set<string>;
    indexingFileIds: Set<string>;
    pendingCliFiles: number;
    processedCache: Record<string, ProcessedCache>;
    bridgedUpdateTrigger: number;
    searchQuery: string;
    searchConfig: SearchConfig;
    isFindVisible: boolean;
    activeView: string;
    scrollToIndex: number | null;
    highlightedIndex: number | null;
    settings: AppSettings;
    resolvedTheme: 'dark' | 'light';
    hasNewContent: boolean;
    onOpen: () => void;
    onLineClick: (idx: number) => void;
    onAddLayer: (type: LayerType, config?: any) => void;
    onToggleBookmark: (lineIndex: number) => void;
    onUpdateBookmarkComment: (lineIndex: number, comment: string) => void;
    onSelectedTextChange: (text: string) => void;
    onSendToAI: (text: string) => void;
    onScrollToNewContent: () => void;
}

const EditorAreaContext = React.createContext<EditorAreaData | null>(null);

function resolveFile(files: FileData[], params: LogViewerPanelParams | undefined): FileData | undefined {
    if (!params) return undefined;
    if (params.fileId) {
        const byId = files.find(f => f.id === params.fileId);
        if (byId) return byId;
    }
    if (params.uri) {
        return files.find(f => f.path === params.uri);
    }
    return undefined;
}

// dockview `logViewer` 面板组件：经 params.fileId / params.uri 渲染现有 LogViewer
const LogViewerPanel: React.FC<IDockviewPanelProps<LogViewerPanelParams>> = ({ params }) => {
    const data = useContext(EditorAreaContext);
    const file = resolveFile(data?.files || [], params);

    // 文件尚未加载完成（可能刚被加入列表）
    if (data && file) {
        const fileId = file.id;
        const isLoading = data.loadingFileIds.has(fileId) || data.indexingFileIds.has(fileId);
        const isActive = data.activeFileId === fileId;

        if (isLoading) {
            return <FileLoadingSkeleton fileName={file.name} />;
        }

        return (
            <div className="h-full w-full flex flex-col relative min-h-0 overflow-hidden">
                <LogViewer
                    key={fileId}
                    totalLines={file.lineCount}
                    fileId={fileId}
                    searchQuery={(data.isFindVisible || data.activeView === 'search') ? data.searchQuery : ''}
                    searchConfig={data.searchConfig}
                    scrollToIndex={isActive ? data.scrollToIndex : null}
                    highlightedIndex={isActive ? data.highlightedIndex : null}
                    onLineClick={data.onLineClick}
                    onAddLayer={data.onAddLayer}
                    onToggleBookmark={data.onToggleBookmark}
                    onUpdateBookmarkComment={data.onUpdateBookmarkComment}
                    onSelectedTextChange={data.onSelectedTextChange}
                    onSendToAI={data.onSendToAI}
                    updateTrigger={data.bridgedUpdateTrigger}
                    settings={data.settings}
                    resolvedTheme={data.resolvedTheme}
                    hasNewContent={data.hasNewContent}
                    onScrollToNewContent={data.onScrollToNewContent}
                />
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
            className="flex-1 flex flex-col items-center justify-center text-gray-600 bg-theme-base cursor-pointer hover:bg-theme-surface transition-colors"
            onClick={data.onOpen}
        >
            <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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
}

export const EditorArea: React.FC<EditorAreaProps> = (props) => {
    const apiRef = useRef<DockviewApi | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    // 布局持久化：防抖保存
    const saveLayout = useCallback((api: DockviewApi) => {
        try {
            const json = api.toJSON();
            localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(json));
        } catch (e) {
            console.error('[EditorArea] Failed to save layout:', e);
        }
    }, []);

    const onReady = useCallback((event: DockviewReadyEvent) => {
        const api = event.api;
        apiRef.current = api;
        props.onApiReady(api);

        // 恢复布局；失败则按当前打开文件添加默认面板
        let restored = false;
        try {
            const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
            if (raw) {
                const json = JSON.parse(raw);
                api.fromJSON(json);
                restored = true;
            }
        } catch (e) {
            console.error('[EditorArea] Failed to restore layout:', e);
        }

        // 兜底：确保所有当前打开文件（wasOpen）都有面板（restore 失败或 restore 前的文件）
        if (!restored) {
            propsRef.current.files.filter(f => f.wasOpen !== false).forEach(file => {
                const panelId = `log-${file.id}`;
                if (!api.getPanel(panelId)) {
                    api.addPanel({
                        id: panelId,
                        component: 'logViewer',
                        title: file.name,
                        params: { fileId: file.id, uri: file.path },
                        inactive: true
                    });
                }
            });
        }

        // 激活面板变化 → 通知外部更新 activeFileId
        api.onDidActivePanelChange((e) => {
            const file = resolveFile(propsRef.current.files, e.panel?.params as LogViewerPanelParams | undefined);
            propsRef.current.onFileActivated(file?.id ?? null);
        });

        // 面板关闭 → 若无其他面板引用同一文件，则释放会话
        api.onDidRemovePanel((panel) => {
            const fileId = panel.params?.fileId as string | undefined;
            const uri = panel.params?.uri as string | undefined;
            if (!fileId && !uri) return;
            const stillReferenced = api.panels.some(p =>
                (p.params?.fileId && p.params.fileId === fileId) ||
                (p.params?.uri && p.params.uri === uri)
            );
            if (!stillReferenced) {
                const file = resolveFile(propsRef.current.files, panel.params as LogViewerPanelParams | undefined);
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
    }, [saveLayout, props]);

    // 文件列表变化时：确保每个打开文件都有对应面板，并关闭已移除/已关闭文件的面板
    useEffect(() => {
        const api = apiRef.current;
        if (!api) return;

        // 仅 wasOpen 的文件才有编辑器面板（历史文件不自动打开）
        const openFiles = props.files.filter(f => f.wasOpen !== false);
        const knownIds = new Set(openFiles.map(f => f.id));
        const knownUris = new Set(openFiles.map(f => f.path).filter(Boolean));
        for (const panel of [...api.panels]) {
            const fid = panel.params?.fileId;
            const uri = panel.params?.uri;
            const matchesFile = (fid && knownIds.has(fid)) || (uri && knownUris.has(uri));
            if (!matchesFile) {
                api.removePanel(panel);
            }
        }

        for (const file of openFiles) {
            const exists = api.panels.some(p =>
                p.params?.fileId === file.id || (file.path && p.params?.uri === file.path)
            );
            if (!exists) {
                api.addPanel({
                    id: `log-${file.id}`,
                    component: 'logViewer',
                    title: file.name,
                    params: { fileId: file.id, uri: file.path },
                    inactive: true
                });
            }
        }
    }, [props.files]);

    // 激活文件变化 → 激活对应面板
    useEffect(() => {
        const api = apiRef.current;
        if (!api || !props.activeFileId) return;
        const file = props.files.find(f => f.id === props.activeFileId);
        if (!file) return;
        const panel = api.panels.find(p => p.params?.fileId === props.activeFileId || (file.path && p.params?.uri === file.path));
        if (panel) {
            panel.api.setActive();
        }
    }, [props.activeFileId, props.files]);

    const contextValue = useMemo<EditorAreaData>(() => ({
        files: props.files,
        activeFileId: props.activeFileId,
        loadingFileIds: props.loadingFileIds,
        indexingFileIds: props.indexingFileIds,
        pendingCliFiles: props.pendingCliFiles,
        processedCache: props.processedCache,
        bridgedUpdateTrigger: props.bridgedUpdateTrigger,
        searchQuery: props.searchQuery,
        searchConfig: props.searchConfig,
        isFindVisible: props.isFindVisible,
        activeView: props.activeView,
        scrollToIndex: props.scrollToIndex,
        highlightedIndex: props.highlightedIndex,
        settings: props.settings,
        resolvedTheme: props.resolvedTheme,
        hasNewContent: props.hasNewContent,
        onOpen: props.onOpen,
        onLineClick: props.onLineClick,
        onAddLayer: props.onAddLayer,
        onToggleBookmark: props.onToggleBookmark,
        onUpdateBookmarkComment: props.onUpdateBookmarkComment,
        onSelectedTextChange: props.onSelectedTextChange,
        onSendToAI: props.onSendToAI,
        onScrollToNewContent: props.onScrollToNewContent
    }), [
        props.files, props.activeFileId, props.loadingFileIds, props.indexingFileIds,
        props.pendingCliFiles, props.processedCache, props.bridgedUpdateTrigger,
        props.searchQuery, props.searchConfig, props.isFindVisible, props.activeView,
        props.scrollToIndex, props.highlightedIndex, props.settings, props.resolvedTheme,
        props.hasNewContent, props.onOpen, props.onLineClick, props.onAddLayer,
        props.onToggleBookmark, props.onUpdateBookmarkComment, props.onSelectedTextChange,
        props.onSendToAI, props.onScrollToNewContent
    ]);

    const themeClass = props.resolvedTheme === 'light' ? 'dockview-theme-light' : 'dockview-theme-dark';

    // 拖放打开文件：读取 dataTransfer.files 的 path，交给外部统一打开
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const raw = Array.from(e.dataTransfer.files || []) as any[];
        const paths = raw
            .filter((f: any) => f.path)
            .map((f: any) => ({ name: f.name, path: f.path }));
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
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden" onDrop={handleDrop} onDragOver={handleDragOver}>
                <DockviewReact
                    className={themeClass}
                    onReady={onReady}
                    components={{ logViewer: LogViewerPanel }}
                    watermarkComponent={WelcomeWatermark}
                />
            </div>
        </EditorAreaContext.Provider>
    );
};
