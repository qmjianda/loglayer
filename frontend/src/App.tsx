/**
 * App.tsx - 应用程序主入口
 *
 * 采用了 Hook 分离架构，将复杂的业务逻辑分发到各个 custom hooks 中：
 * - useFileManagement: 处理文件打开、关闭、切换。
 * - useLayerManagement: 处理图层的增删改查、拖拽排序、撤销重做。
 * - useSearch: 处理全局搜索逻辑。
 * - useBridge: 处理前端与 Python 后端的信号监听与数据同步。
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { DockviewApi } from 'dockview-react';
import { EditorArea } from './components/EditorArea';
import { EditorGoToLineWidget } from './components/EditorGoToLineWidget';
import { HelpPanel } from './components/HelpPanel';
import { StatusBar } from './components/StatusBar';
import { IndexingOverlay } from './components/LoadingOverlays';
import { InspectorDock } from './components/layout/InspectorDock';
import { SidebarView } from './components/layout/SidebarView';
import { AppOverlays } from './components/layout/AppOverlays';
import { LayerType, LogLine, LogLevelStats } from './types';
import { ProcessedCache } from './hooks/useFileManagement';
import {
  openFile,
  syncAll,
  toggleBookmark,
  getNearestBookmarkIndex,
  getLinesByIndices,
  getLogLevelStats,
  setCacheConfig,
} from './bridge_client';
import { removeFromSet } from './utils';
import { timingLog } from './utils/timing';

// 导入自定义 Hooks
import {
  useBridge,
  useUIState,
  useWorkspaceConfig,
  useRemotePathPicker,
  setBridgedCount,
  FileLoadedInfo,
} from './hooks';
import { useFileManagement } from './hooks/useFileManagement';
import { useLayerManagement } from './hooks/useLayerManagement';
import { useSearch } from './hooks/useSearch';
import { useSearchStore } from './store/searchStore';
import { useBookmarkLogic } from './hooks/useBookmarkLogic';
import { useBookmarks, invalidateBookmarkCache } from './hooks/useBookmarks';
import { useFileActions } from './hooks/useFileActions';
import { useCommands } from './hooks/useCommands';
import { useSettings, SettingsProvider } from './hooks/useSettings';
import { useResponsive } from './hooks/useResponsive';
import { useFileWatch } from './hooks/useFileWatch';

const AppContent: React.FC = () => {
  // ===== 设置管理 (Settings Management) =====
  const { settings, resolvedTheme } = useSettings();

  // ===== 响应式布局 (Responsive Layout) =====
  const responsive = useResponsive();

  // ===== 文件管理 (File Management) =====
  // 负责维护当前打开的文件列表、激活的文件、分栏状态等。
  const fileManagement = useFileManagement();
  const {
    files,
    setFiles,
    activeFileId,
    activeFile,
    loadingFileIds,
    indexingFileIds,
    setIndexingFileIds,
    pendingCliFiles,
    setPendingCliFiles,
    processedCache,
    setProcessedCache,
    bridgedUpdateTrigger,
    triggerUpdate,
    setActiveFileId,
    handleFileActivate,
    handleFileRemove,
    handleFileClosed,
    addNewFiles,
    handleNativeFileSelect,
    handleNativeFolderSelect,
    handleOpenFileByPath,
    fileInputRef,
    folderInputRef,
    handleFileUpload,
    handleFolderUpload,
    markFileLoaded,
  } = fileManagement;

  // dockview API ref（由 EditorArea onReady 注入）
  const dockApiRef = useRef<DockviewApi | null>(null);

  // 便捷访问器：获取当前激活文件的基础统计信息
  const fileName = activeFile?.name || '';
  const fileSize = activeFile?.size || 0;
  const activeProcessed = activeFileId ? processedCache[activeFileId] : null;
  const layerStats = activeProcessed?.layerStats || {};
  const searchMatchCount = activeProcessed?.searchMatchCount || 0;

  // ===== 图层管理 (Layer Management) =====
  // 负责管理针对每个文件的图层流水线配置。
  const layerManagement = useLayerManagement({
    activeFileId,
    activeFile,
    files,
    setFiles,
    searchQuery: '', // 将在 useSearch 之后连接
    searchConfig: { regex: false, caseSensitive: false },
  });

  const {
    layers,
    selectedLayerId,
    setSelectedLayerId,
    past,
    future,
    layersFunctionalHash,
    updateLayers,
    addLayer,
    handleDrop,
    undo,
    redo,
    canUndo,
    canRedo,
    presets,
    setPresets,
    handleSavePresetWithName,
    applyPreset,
    saveStatus,
  } = layerManagement;

  // ===== 搜索状态 (Search State) =====
  // 集中管理搜索相关的视图状态（searchConfig.mode 由 useSearch 管理，find widget 经 LogViewerPanel 直读 store）

  // UI 状态控制 (UI State)
  // 处理各种面板显隐、滚动定位、进度条、工作区根目录等。
  // Note: 书签导航将在 uiState 返回后定义，使用 useEffect 注册
  // ===== 搜索功能逻辑 (Search Logic Hook) =====
  // Must be called BEFORE useUIState because UI state depends on search methods
  const activePanelId = useSearchStore((s) => s.activePanelId);
  const search = useSearch({
    activeFileId,
    activePanelId,
    layers,
    layersFunctionalHash,
    lineCount: activeFile?.lineCount || 0,
    searchMatchCount,
    setProcessedCache,
  });

  const {
    searchQuery,
    setSearchQuery,
    searchConfig,
    setSearchConfig,
    currentMatchRank,
    currentMatchIndex,
    isSearching,
    setIsSearching,
    currentMatchNumber,
    findNextSearchMatch,
    jumpToRank,
    clearSearch,
  } = search;

  // 清空搜索（Esc 第二段 / 关闭查找条）：清词、重置 rank/cache 计数
  const handleClearSearch = useCallback(() => {
    clearSearch();
    if (activeFileId) {
      setProcessedCache((prev) => {
        const newCache = { ...prev };
        newCache[activeFileId] = {
          ...(prev[activeFileId] || { layerStats: {}, searchMatchCount: 0 }),
          searchMatchCount: 0,
        };
        return newCache;
      });
    }
  }, [clearSearch, activeFileId, setProcessedCache]);

  const [canvasSelectedText, setCanvasSelectedText] = useState('');
  const [isCommandPaletteVisible, setIsCommandPaletteVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isShortcutsVisible, setIsShortcutsVisible] = useState(false);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [aiPanelInitialContent, setAiPanelInitialContent] = useState('');
  const [logLevelStats, setLogLevelStats] = useState<LogLevelStats>({
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    DEBUG: 0,
    TRACE: 0,
  });
  // [perf-deepening] 统计拉取中标记（驱动 InspectorSummary 骨架屏，消除切文件后的数字跳变）
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch log level stats when active file changes
  const fetchLogLevelStats = useCallback(async (fileId: string) => {
    setStatsLoading(true);
    try {
      const stats = await getLogLevelStats(fileId);
      setLogLevelStats({
        ERROR: stats.ERROR || 0,
        WARN: stats.WARN || 0,
        INFO: stats.INFO || 0,
        DEBUG: stats.DEBUG || 0,
        TRACE: stats.TRACE || 0,
        FATAL: stats.FATAL || 0,
      });
    } catch (e) {
      console.error('[App] Failed to fetch log level stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 切文件时清空旧 stats；实际拉取仅由 onFileLoaded 触发（避免与索引并行 + 重复请求）
  useEffect(() => {
    if (!activeFileId) {
      setLogLevelStats({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 });
    }
  }, [activeFileId]);

  // Apply search settings from useSettings
  useEffect(() => {
    if (
      settings.searchRegexDefault !== searchConfig.regex ||
      settings.searchCaseSensitiveDefault !== searchConfig.caseSensitive
    ) {
      setSearchConfig((prev) => ({
        ...prev,
        regex: settings.searchRegexDefault,
        caseSensitive: settings.searchCaseSensitiveDefault,
      }));
    }
  }, [settings.searchRegexDefault, settings.searchCaseSensitiveDefault]);

  // 同步缓存大小配置到后端（启动时让持久化设置生效）
  useEffect(() => {
    setCacheConfig(settings.cacheSizeMB);
  }, [settings.cacheSizeMB]);

  // ===== UI 状态控制 (UI State) =====
  // 处理各种面板显隐、滚动定位、进度条、工作区根目录等。
  // Note: 书签导航将在 uiState 返回后定义，使用 useEffect 注册
  const uiState = useUIState({
    undo,
    redo,
    setSearchQuery: (q: string) => search.setSearchQuery(q), // Connect to search logic
    searchQuery: search.searchQuery, // Connect to search logic
    canvasSelectedText,
    onToggleSidebar: () => {
      // 切换侧边栏显示/隐藏 - 使用 setTimeout 避免循环依赖
      setTimeout(() => {
        const currentWidth = sidebarWidth;
        setSidebarWidth(currentWidth > 0 ? 0 : 288);
      }, 0);
    },
    onOpenFile: () => {
      handleOpen();
    },
    onOpenFolder: () => {
      handleNativeFolderSelect();
    },
    onShowSearchHistory: () => {
      // Ctrl+H：打开激活面板的 find widget 并触发 focus
      const panelId = useSearchStore.getState().activePanelId;
      if (panelId) useSearchStore.getState().requestFocus(panelId);
    },
    onClearSearch: handleClearSearch,
  });

  const {
    activeView,
    setActiveView,
    sidebarWidth,
    setSidebarWidth,
    inspectorWidth,
    setInspectorWidth,
    isGoToLineVisible,
    setIsGoToLineVisible,
    scrollToIndex,
    setScrollToIndex,
    highlightedIndex,
    setHighlightedIndex,
    isProcessing,
    setIsProcessing,
    loadingProgress,
    setLoadingProgress,
    operationStatus,
    setOperationStatus,
    workspaceRoot,
    setWorkspaceRoot,
    handleJumpToLine,
  } = uiState;

  // ===== 文件监视 (File Watch) =====
  const { isWatching, startWatching, stopWatching, hasNewContent, clearNewContent } = useFileWatch(
    undefined,
    (newLineCount, totalLines) => {
      // Auto-scroll to bottom when new content arrives（用后即清，避免残留的
      // scrollToIndex 在后续切换面板时被应用到别的文件）
      if (totalLines > 0) {
        setScrollToIndex(totalLines - 1);
        setTimeout(() => setScrollToIndex(null), 150);
      }
    },
  );

  const handleToggleWatch = useCallback(() => {
    if (isWatching) {
      stopWatching();
    } else if (activeFileId) {
      startWatching(activeFileId);
    }
  }, [isWatching, activeFileId, startWatching, stopWatching]);

  // ===== 书签数据管理 (Bookmarks Data Management) =====
  // 集中管理当前文件的书签状态、备注和预览
  const {
    bookmarks,
    previews: bookmarkPreviews,
    toggle: handleToggleBookmark,
    updateComment: handleUpdateBookmarkComment,
    clear: handleClearBookmarks,
    jumpTo: handleJumpToBookmark,
  } = useBookmarks(activeFileId);

  // ===== 书签快捷键导航 (Bookmark Shortcuts) =====
  useBookmarkLogic({
    activeFileId,
    highlightedIndex,
    setHighlightedIndex,
    setScrollToIndex,
  });
  // F2/Shift+F2 快捷键跳转到上/下一个书签
  const [isLayerProcessing, setIsLayerProcessing] = React.useState(false);

  // ===== 工作区持久化 (Workspace Config Persistence) =====
  // 自动将当前打开的文件和图层配置保存到本地磁盘（.loglayer 目录），
  // 布局经 kv['layout'] 随工作区持久化（EditorArea 通过 onLayoutChange 回写）。
  const { layout: editorLayout, saveLayout } = useWorkspaceConfig({
    workspaceRoot,
    files,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFilePath: activeFile?.path,
    handleFileActivate,
  });

  // 导航到下一个搜索匹配项，并自动滚动到底部/指定行
  const findNextSearchMatchWithJump = useCallback(
    async (direction: 'next' | 'prev') => {
      // [OPTIMIZATION] Nearest neighbor jumping
      // If we have a highlighted index (user click or previous jump), we find the match nearest to it.
      const nextIdx = await findNextSearchMatch(direction, highlightedIndex);
      if (nextIdx !== -1) {
        handleJumpToLine(nextIdx, activeFile?.lineCount || 0);
      }
    },
    [findNextSearchMatch, handleJumpToLine, activeFile?.lineCount, highlightedIndex],
  );

  // ===== 桥接层集成 (Bridge Integration) =====
  // 监听来自 Python 后端的信号（文件加载完成、搜索完成、统计完成等）。
  const {
    bridgeApi,
    activeFileIdRef,
    setActiveFileId: setBridgeActiveFileId,
  } = useBridge({
    // 当后端成功解析并建立文件索引后触发
    onFileLoaded: (fileId: string, info: FileLoadedInfo) => {
      timingLog('signal.fileLoaded', fileId, `lines=${info.lineCount}`);
      // 重新索引完成，书签缓存失效（下次切换该文件时重新拉取）
      invalidateBookmarkCache(fileId);

      // [BUG FIX] Sanitization: Check if the file is still supposed to be open
      setFiles((prev) => {
        const existingIndex = prev.findIndex((f) => f.id === fileId);

        // If the file was removed from the list before this signal arrived, ignore it.
        // Special case: CLI files might not be in the list yet.
        if (existingIndex === -1 && !fileId.startsWith('cli-')) {
          console.log(`[App] Ignoring onFileLoaded for closed file: ${fileId}`);
          return prev;
        }

        setBridgedCount(fileId, info.lineCount);

        if (existingIndex >= 0) {
          const newFiles = [...prev];
          const oldFile = prev[existingIndex];
          newFiles[existingIndex] = {
            ...oldFile,
            lineCount: info.lineCount,
            rawCount: info.lineCount,
            size: info.size,
            path: info.path || oldFile.path,
          };
          return newFiles;
        } else {
          // This handles CLI files or auto-restored files that aren't in the list yet
          const newFile = {
            id: fileId,
            name: info.name,
            size: info.size,
            lineCount: info.lineCount,
            rawCount: info.lineCount,
            layers: [],
            isBridged: true as const,
            path: info.path || info.name,
            wasOpen: true as const,
            history: { past: [], future: [] },
          };
          setTimeout(() => setActiveFileId(fileId), 0);
          return [...prev, newFile];
        }
      });

      // 单阶段完整索引：fileLoaded 只在完整索引完成后发出一次
      triggerUpdate();
      setIsProcessing(false);
      setOperationStatus(null);
      markFileLoaded(fileId);
      // 文件加载完成后会话已建立：补拉级别统计（首次 fetch 可能早于 session 就绪）
      fetchLogLevelStats(fileId);
      setIndexingFileIds((prev) => removeFromSet(prev, fileId));
    },

    // 当后端 Pipeline 运行结束（过滤/搜索合并）后触发
    onPipelineFinished: (fileId, newTotal, matchCount) => {
      timingLog('signal.pipelineFinished', fileId, `total=${newTotal} matches=${matchCount}`);
      setBridgedCount(fileId, newTotal);
      setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, lineCount: newTotal } : f)));
      setProcessedCache((prev) => {
        const newCache = { ...prev };
        newCache[fileId] = {
          ...(prev[fileId] || {}),
          searchMatchCount: matchCount,
        } as ProcessedCache;
        return newCache;
      });
      triggerUpdate();

      if (activeFileIdRef.current === fileId) {
        // [perf-deepening] 在途搜索结果应用后推进已应用序号（残留/重复信号判定的依据）
        const pendingPanelId = useSearchStore.getState().activePanelId;
        if (pendingPanelId) {
          const pendingTab = useSearchStore.getState().tabs[pendingPanelId];
          if (pendingTab && pendingTab.requestSeq > pendingTab.consumedSeq) {
            useSearchStore.getState().markSearchConsumed(pendingPanelId);
          }
        }
        setOperationStatus(null);
        setIsProcessing(false);
        setIsSearching(false);
        setIndexingFileIds((prev) => removeFromSet(prev, fileId));

        // [BUG FIX 3] Nearest jumping after search finishes
        // If we are in searching mode and no rank is selected yet, jump to the nearest!
        if (searchQuery && matchCount > 0 && currentMatchRank === -1) {
          // Use a tiny timeout to let React finish the current state update cycle (setProcessedCache)
          // so the subsequent findNextSearchMatchWithJump sees the correct matchCount.
          setTimeout(() => {
            findNextSearchMatchWithJump('next');
          }, 0);
        }
      }
    },

    // 当后端各图层统计数据计算完成后触发
    onStatsFinished: (fileId, stats) => {
      timingLog('signal.statsFinished', fileId);
      setProcessedCache((prev) => {
        const newCache = { ...prev };
        newCache[fileId] = {
          ...(prev[fileId] || { layerStats: {}, searchMatchCount: 0 }),
          layerStats: { ...prev[fileId]?.layerStats, ...stats },
        };
        return newCache;
      });
    },

    // 监听各种后台任务的进度（Indexing, Pipeline, Searching 等）
    onOperationStarted: (fileId, op) => {
      timingLog('signal.operationStarted', fileId, `op=${op}`);
      if (op === 'indexing') {
        setIndexingFileIds((prev) => new Set(prev).add(fileId));
      }

      if (activeFileIdRef.current === fileId) {
        setOperationStatus({ op, progress: 0 });
        setLoadingProgress(0);
        if (op === 'searching') setIsSearching(true);
        else setIsProcessing(true);
      }
    },

    onOperationProgress: (fileId, op, progress) => {
      if (activeFileIdRef.current === fileId) {
        setOperationStatus({ op, progress });
        setLoadingProgress(progress);
      }
    },

    onOperationError: (fileId, op, message) => {
      if (activeFileIdRef.current === fileId) {
        setOperationStatus({ op, progress: 0, error: message });
        setIsProcessing(false);
        setIsSearching(false);
        setIndexingFileIds((prev) => removeFromSet(prev, fileId));
      }
    },

    // 处理从 CLI 启动时排队解析的文件
    onPendingFilesCount: (count) => {
      setPendingCliFiles(count);
    },

    // 处理从 CLI 启动时传入的文件夹路径
    onWorkspaceOpened: (path) => {
      const folderName = path.split(/[/\\]/).pop() || path;
      setWorkspaceRoot({ path, name: folderName });
    },
  });

  // 保持 bridge 层的引用与当前激活文件一致
  useEffect(() => {
    setBridgeActiveFileId(activeFileId);
  }, [activeFileId, setBridgeActiveFileId]);

  // 导航到下一个搜索匹配项，并自动滚动到底部/指定行已被移动到上方

  // ===== 远程路径选择器 (Remote Path Picker) =====
  // 用于 --no-ui 模式下替代原生文件对话框
  const remotePathPicker = useRemotePathPicker();
  const {
    isOpen: isRemotePickerOpen,
    mode: remotePickerMode,
    listDirectory: remoteListDirectory,
    onSelect: handleRemotePathSelect,
    onOpenChange: setRemotePickerOpen,
  } = remotePathPicker;

  // 远程选择器的确认回调
  const [remotePickerCallback, setRemotePickerCallback] = useState<
    ((result: { path: string; isDir: boolean }) => void) | null
  >(null);

  // 打开远程统一选择器
  const openRemotePicker = useCallback(
    (callback: (result: { path: string; isDir: boolean }) => void) => {
      setRemotePickerCallback(() => callback);
      remotePathPicker.openPathPicker();
    },
    [remotePathPicker],
  );

  // 处理远程选择器结果
  const handleRemotePathSelected = useCallback(
    (path: string, isDir: boolean) => {
      handleRemotePathSelect(path, isDir);
      if (remotePickerCallback) {
        remotePickerCallback({ path, isDir });
        setRemotePickerCallback(null);
      }
    },
    [handleRemotePathSelect, remotePickerCallback],
  );

  // 处理远程选择器关闭
  const handleRemotePickerClose = useCallback(
    (open: boolean) => {
      setRemotePickerOpen(open);
      if (!open) {
        setRemotePickerCallback(null);
      }
    },
    [setRemotePickerOpen],
  );

  // 文件操作编排（统一打开/编辑器内打开/激活加载）提取至 useFileActions
  const { openFileInEditor, handleFileActivateWithLoad, handleOpen } = useFileActions({
    dockApiRef,
    files,
    handleFileActivate,
    handleNativeFolderSelect,
    setWorkspaceRoot,
    openRemotePicker,
    handleOpenFileByPath,
  });

  // ===== 命令面板 (Command Palette) =====
  const commands = useCommands({
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
  });

  return (
    <div
      className="flex flex-col h-screen select-none overflow-hidden text-sm bg-theme-base text-primary"
      onDragOver={(e) => {
        // 关键修复：防止浏览器默认的拖拽操作（如直接打开文件）
        // 这样组件内部的 Drop 区域才能正常工作。
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
    >
      {/* 隐藏的文件上传 Input 控件 */}
      <input
        ref={fileInputRef as any}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        accept=".log,.txt,.json,*"
      />
      <input
        ref={folderInputRef as any}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFolderUpload}
        // @ts-expect-error - webkitdirectory 是非标准属性，用于选择目录
        webkitdirectory=""
        directory=""
        multiple
      />

      {/* 顶部标题栏 */}
      <div className="h-9 bg-tertiary flex items-center px-4 border-b border-subtle shrink-0 justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-blue-400 font-black tracking-tighter flex items-center cursor-default">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5-10-5zM2 17l10 5 10-5-10-5-10 5zM2 12l10 5 10-5-10-5-10 5z" />
            </svg>
            LogLayer
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
            {fileName || (isProcessing ? '正在解析文件...' : '就绪')}
            {files.length > 1 && ` (+${files.length - 1})`}
          </div>
          {/* 右侧操作台折叠按钮（与左侧 sidebar 折叠对称） */}
          <button
            onClick={() => setInspectorWidth((w) => (w > 0 ? 0 : 300))}
            className={`p-1 rounded transition-colors ${inspectorWidth > 0 ? 'text-theme-muted hover:text-theme-primary hover:bg-theme-elevated' : 'text-theme-muted'}`}
            title={inspectorWidth > 0 ? '折叠右侧操作台' : '展开右侧操作台'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {inspectorWidth > 0 ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 顶部进度条 - 使用绝对定位防止布局跳动 */}
      <div className="absolute top-9 left-0 right-0 h-0.5 z-50 pointer-events-none">
        {(isProcessing || isLayerProcessing) && (
          <div
            className={`h-full bg-blue-500 transition-all duration-300 ${isLayerProcessing ? 'animate-pulse' : ''}`}
            style={{ width: isLayerProcessing ? '100%' : `${loadingProgress}%` }}
          />
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏与视图切换区（提取至 SidebarView） */}
        <SidebarView
          activeView={activeView}
          setActiveView={setActiveView}
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          isMobile={responsive.isMobile}
          workspaceRoot={workspaceRoot}
          files={files}
          activeFileId={activeFileId}
          activeFile={activeFile}
          searchConfig={searchConfig}
          setSearchConfig={setSearchConfig}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchMatchCount={searchMatchCount}
          currentMatchNumber={currentMatchNumber}
          aiPanelInitialContent={aiPanelInitialContent}
          isWatching={isWatching}
          hasNewContent={hasNewContent}
          onToggleWatch={handleToggleWatch}
          onOpenSettings={() => setIsSettingsVisible(true)}
          onOpenFileByPath={handleOpenFileByPath}
          onOpen={handleOpen}
          onFileActivate={handleFileActivateWithLoad}
          onFileRemove={handleFileRemove}
          onFindNavigate={findNextSearchMatchWithJump}
          onJumpToLine={(idx) => handleJumpToLine(idx, activeFile?.lineCount || 0)}
          onJumpToRank={jumpToRank}
          onApplySuggestion={(type, value) => {
            if (type === 'filter') {
              addLayer(LayerType.FILTER, { query: value });
            } else if (type === 'highlight') {
              addLayer(LayerType.HIGHLIGHT, { query: value, color: '#facc15' });
            }
          }}
          onCloseAI={() => {
            setActiveView('main');
            setAiPanelInitialContent('');
          }}
        />

        {/* 主内容区域：显示日志视图或帮助文档 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-theme-base relative select-text overflow-hidden">
          {activeView === 'help' ? (
            <HelpPanel />
          ) : (
            <>
              {/* 中间编辑器区域（dockview 分屏承载） */}
              <EditorArea
                files={files}
                activeFileId={activeFileId}
                loadingFileIds={loadingFileIds}
                indexingFileIds={indexingFileIds}
                indexingProgress={loadingProgress}
                pendingCliFiles={pendingCliFiles}
                processedCache={processedCache}
                bridgedUpdateTrigger={bridgedUpdateTrigger}
                searchQuery={searchQuery}
                searchConfig={searchConfig}
                activeView={activeView}
                scrollToIndex={scrollToIndex}
                highlightedIndex={highlightedIndex}
                settings={settings}
                resolvedTheme={resolvedTheme}
                hasNewContent={hasNewContent}
                bookmarks={bookmarks}
                onOpen={handleOpen}
                onLineClick={(idx) => setHighlightedIndex(idx)}
                onAddLayer={(type, config) => addLayer(type, config)}
                onToggleBookmark={handleToggleBookmark}
                onUpdateBookmarkComment={handleUpdateBookmarkComment}
                onSelectedTextChange={setCanvasSelectedText}
                onSendToAI={(text) => {
                  setAiPanelInitialContent(text);
                  setActiveView('ai');
                }}
                onScrollToNewContent={() => {
                  clearNewContent();
                  if (activeFile?.lineCount) {
                    setScrollToIndex(activeFile.lineCount - 1);
                  }
                }}
                onFindNavigate={findNextSearchMatchWithJump}
                onFileActivated={(fileId) => setActiveFileId(fileId)}
                onFileClosed={handleFileClosed}
                onApiReady={(api) => {
                  dockApiRef.current = api;
                }}
                onFileDrop={(paths) => addNewFiles(paths)}
                initialLayout={editorLayout}
                onLayoutChange={saveLayout}
              />
            </>
          )}
        </div>

        {/* 右侧操作台（当前文件：摘要/图层/预设/书签/统计） */}
        <InspectorDock
          activeFile={activeFile}
          layers={layers}
          selectedLayerId={selectedLayerId}
          setSelectedLayerId={setSelectedLayerId}
          layerStats={layerStats}
          inspectorWidth={inspectorWidth}
          setInspectorWidth={setInspectorWidth}
          isMobile={responsive.isMobile}
          bookmarks={bookmarks}
          bookmarkPreviews={bookmarkPreviews}
          presets={presets}
          canUndo={canUndo}
          canRedo={canRedo}
          saveStatus={saveStatus}
          logLevelStats={logLevelStats}
          statsLoading={statsLoading}
          onLayerRemove={(id) =>
            updateLayers((prev) => prev.filter((l) => l.id !== id && l.groupId !== id))
          }
          onLayerToggle={(id) =>
            updateLayers((prev) =>
              prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)),
            )
          }
          onLayerUpdate={(id, update) =>
            updateLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...update } : l)))
          }
          onLayerDrop={(draggedId, targetId, position) => handleDrop(draggedId, targetId, position)}
          onAddLayer={addLayer}
          onJumpToLine={(idx) => handleJumpToLine(idx, activeFile?.lineCount || 0)}
          onUndo={undo}
          onRedo={redo}
          onPresetApply={applyPreset}
          onPresetDelete={(id) => {
            const next = presets.filter((p) => p.id !== id);
            setPresets(next);
            localStorage.setItem('loglayer_presets', JSON.stringify(next));
          }}
          onSavePresetWithName={handleSavePresetWithName}
          onToggleBookmark={handleToggleBookmark}
          onClearBookmarks={handleClearBookmarks}
          onJumpToBookmark={(idx) =>
            handleJumpToBookmark(idx, (visualIdx) =>
              handleJumpToLine(visualIdx, activeFile?.lineCount || 0),
            )
          }
        />
      </div>

      <StatusBar
        lines={activeFile?.lineCount || 0}
        totalLines={activeFile?.rawCount || 0}
        size={fileSize}
        isProcessing={isProcessing || (activeFileId ? loadingFileIds.has(activeFileId) : false)}
        isLayerProcessing={isLayerProcessing}
        operationStatus={operationStatus}
        searchMatchCount={searchMatchCount}
        currentLine={highlightedIndex !== null ? highlightedIndex + 1 : undefined}
        pendingCliFiles={pendingCliFiles}
        isWatching={isWatching}
        hasNewContent={hasNewContent}
        onOpenSettings={() => setIsSettingsVisible(true)}
        onOpenShortcuts={() => setIsShortcutsVisible(true)}
      />

      {/* 应用级浮层（提取至 AppOverlays） */}
      <AppOverlays
        isRemotePickerOpen={isRemotePickerOpen}
        remotePickerMode={remotePickerMode}
        onRemotePickerClose={handleRemotePickerClose}
        onRemotePathSelected={handleRemotePathSelected}
        remoteListDirectory={remoteListDirectory}
        commands={commands}
        isCommandPaletteVisible={isCommandPaletteVisible}
        setIsCommandPaletteVisible={setIsCommandPaletteVisible}
        isSettingsVisible={isSettingsVisible}
        setIsSettingsVisible={setIsSettingsVisible}
        isDebugVisible={isDebugVisible}
        setIsDebugVisible={setIsDebugVisible}
        isShortcutsVisible={isShortcutsVisible}
        setIsShortcutsVisible={setIsShortcutsVisible}
        isGoToLineVisible={isGoToLineVisible}
        setIsGoToLineVisible={setIsGoToLineVisible}
        totalLines={activeFile?.lineCount || 0}
        onGoToLine={(lineNum) => {
          handleJumpToLine(lineNum - 1, activeFile?.lineCount || 0);
          setIsGoToLineVisible(false);
        }}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
};

export default App;
