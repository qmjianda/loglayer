/**
 * App.tsx - 应用程序主入口
 * 
 * 采用了 Hook 分离架构，将复杂的业务逻辑分发到各个 custom hooks 中：
 * - useFileManagement: 处理文件打开、关闭、切换。
 * - useLayerManagement: 处理图层的增删改查、拖拽排序、撤销重做。
 * - useSearch: 处理全局搜索逻辑。
 * - useBridge: 处理前端与 Python 后端的信号监听与数据同步。
 */

import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { LogViewer } from './components/LogViewer';
import { SearchPanel } from './components/SearchPanel';
import { EditorFindWidget } from './components/EditorFindWidget';
import { EditorGoToLineWidget } from './components/EditorGoToLineWidget';
import { CommandPalette, Command } from './components/CommandPalette';
import { SettingsPanel } from './components/SettingsPanel';
import { KeyboardShortcutsPanel } from './components/KeyboardShortcutsPanel';
import { UnifiedPanel, FileInfo } from './components/UnifiedPanel';
import { HelpPanel } from './components/HelpPanel';
import { StatusBar } from './components/StatusBar';
import { IndexingOverlay, FileLoadingSkeleton, PendingFilesWall } from './components/LoadingOverlays';
import { RemotePathPicker } from './components/RemotePathPicker';
import { AIChatPanel } from './components/AIChatPanel';
import { StatsPanel, LogLevelStats } from './components/StatsPanel';
import { PatternAnalysisPanel } from './components/PatternAnalysisPanel';
import { AppHeader } from './components/AppHeader';
import { useAppCommands } from './components/AppCommands';
import { SidebarPanel } from './components/SidebarPanel';
import { EmptyState } from './components/EmptyState';
import { AppModals } from './components/AppModals';
import { LogViewerPane } from './components/LogViewerPane';
import { FloatingWidgets } from './components/FloatingWidgets';
import { ProgressBar } from './components/ProgressBar';
import { FileInputs } from './components/FileInputs';
import { SidebarContainer } from './components/SidebarContainer';
import { MainContent } from './components/MainContent';
import { LayerType, LogLine } from './types';
import { ProcessedCache } from './hooks/useFileManagement';
import { openFile, syncAll, hasNativeDialogs, toggleBookmark, getNearestBookmarkIndex, getLinesByIndices, getLogLevelStats } from './bridge_client';
import { removeFromSet, basename } from './utils';

// 导入自定义 Hooks
import {
  useBridge,
  useUIState,
  useWorkspaceConfig,
  useRemotePathPicker,
  setBridgedCount,
  FileLoadedInfo
} from './hooks';
import { useFileManagement } from './hooks/useFileManagement';
import { useLayerManagement } from './hooks/useLayerManagement';
import { useSearch } from './hooks/useSearch';
import { useBookmarkLogic } from './hooks/useBookmarkLogic';
import { useBookmarks } from './hooks/useBookmarks';
import { useSettings, SettingsProvider } from './hooks/useSettings';
import { useResponsive } from './hooks/useResponsive';
import { useFileWatch } from './hooks/useFileWatch';
import { usePaneManagement, MAX_PANES } from './hooks/usePaneManagement';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { PaneHeader } from './components/common/PaneHeader';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';


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
    panes,
    setPanes,
    activePaneId,
    setActivePaneId,
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
    addNewFiles,
    handleNativeFileSelect,
    handleNativeFolderSelect,
    handleOpenFileByPath,
    fileInputRef,
    folderInputRef,
    handleFileUpload,
    handleFolderUpload,
    markFileLoaded
  } = fileManagement;

  // 便捷访问器：获取当前激活文件的基础统计信息
  const fileName = activeFile?.name || '';
  const fileSize = activeFile?.size || 0;
  const activeProcessed = activeFileId ? processedCache[activeFileId] : null;
  const layerStats = activeProcessed?.layerStats || {};
  const searchMatchCount = activeProcessed?.searchMatchCount || 0;

  // ===== 分屏管理 (Pane Management) =====
  // 负责管理分屏创建、关闭
  const paneManagement = usePaneManagement(
    panes,
    setPanes,
    activePaneId,
    setActivePaneId,
    files,
    setActiveFileId
  );
  const {
    splitPane,
    removePane
  } = paneManagement;

  // ===== 图层管理 (Layer Management) =====
  // 负责管理针对每个文件的图层流水线配置。
  const layerManagement = useLayerManagement({
    activeFileId,
    activeFile,
    files,
    setFiles,
    searchQuery: '', // 将在 useSearch 之后连接
    searchConfig: { regex: false, caseSensitive: false }
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
    handleSavePreset,
    saveStatus
  } = layerManagement;

  // ===== 搜索状态 (Search State) =====
  // 集中管理搜索相关的视图状态
  // searchMode 纯 UI 状态，保留在 App 中或移入 useSearch (这里先保留在 Component 中)
  // 检查 useSearch 是否导出 searchMode? 暂时没有，所以保留本地 state 用于 Widget 显示控制
  // 但注意 searchConfig.mode 已经在 useSearch 中管理
  
  // 修正：useSearch 内部维护了 searchConfig.mode，我们应该使用它
  // 如果 EditorFindWidget 需要独立的 'filter' | 'highlight' toggle，应该通过 setSearchConfig 更新

  // UI 状态控制 (UI State)
  // 处理各种面板显隐、滚动定位、进度条、工作区根目录等。
  // Note: 书签导航将在 uiState 返回后定义，使用 useEffect 注册
  // ===== 搜索功能逻辑 (Search Logic Hook) =====
  // Must be called BEFORE useUIState because UI state depends on search methods
  const search = useSearch({
    activeFileId,
    layers,
    layersFunctionalHash,
    lineCount: activeFile?.lineCount || 0,
    searchMatchCount,
    setProcessedCache
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
    clearSearch
  } = search;

  // Search Mode for UI Widget (Highlight vs Filter)
  // This is purely UI state for the widget, though it might sync with searchConfig.mode later
  const [searchMode, setSearchMode] = useState<'highlight' | 'filter'>('highlight');
  const [canvasSelectedText, setCanvasSelectedText] = useState('');
  const [isCommandPaletteVisible, setIsCommandPaletteVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isShortcutsVisible, setIsShortcutsVisible] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isStorageSettingsOpen, setIsStorageSettingsOpen] = useState(false);
  const [isWorkerConfigOpen, setIsWorkerConfigOpen] = useState(false);
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false);
  const [aiPanelInitialContent, setAiPanelInitialContent] = useState('');
  const [logLevelStats, setLogLevelStats] = useState<LogLevelStats>({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 });
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  
  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Fetch log level stats when active file changes
  useEffect(() => {
    if (!activeFileId) {
      setLogLevelStats({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 });
      return;
    }

    const fetchStats = async () => {
      try {
        const stats = await getLogLevelStats(activeFileId);
        setLogLevelStats({
          ERROR: stats.ERROR || 0,
          WARN: stats.WARN || 0,
          INFO: stats.INFO || 0,
          DEBUG: stats.DEBUG || 0,
          TRACE: stats.TRACE || 0,
          FATAL: stats.FATAL || 0
        });
      } catch (e) {
        console.error('[App] Failed to fetch log level stats:', e);
      }
    };

    fetchStats();
  }, [activeFileId]);

  // Apply search settings from useSettings
  useEffect(() => {
    if (settings.searchRegexDefault !== searchConfig.regex || 
        settings.searchCaseSensitiveDefault !== searchConfig.caseSensitive) {
      setSearchConfig(prev => ({
        ...prev,
        regex: settings.searchRegexDefault,
        caseSensitive: settings.searchCaseSensitiveDefault
      }));
    }
  }, [settings.searchRegexDefault, settings.searchCaseSensitiveDefault]);

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
    onOpenFile: () => { handleOpen(); },
    onOpenFolder: () => { handleNativeFolderSelect(); },
    onShowSearchHistory: () => setIsFindVisible(true)
  });

  const {
    activeView,
    setActiveView,
    sidebarWidth,
    setSidebarWidth,
    isFindVisible,
    setIsFindVisible,
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
    handleJumpToLine
  } = uiState;

  // ===== 文件监视 (File Watch) =====
  const {
    isWatching,
    startWatching,
    stopWatching,
    hasNewContent,
    clearNewContent
  } = useFileWatch(
    undefined,
    (newLineCount, totalLines) => {
      // Auto-scroll to bottom when new content arrives
      if (totalLines > 0) {
        setScrollToIndex(totalLines - 1);
      }
    }
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
    jumpTo: handleJumpToBookmark
  } = useBookmarks(activeFileId);

  // ===== 书签快捷键导航 (Bookmark Shortcuts) =====
  useBookmarkLogic({
    activeFileId,
    highlightedIndex,
    setHighlightedIndex,
    setScrollToIndex
  });
  // F2/Shift+F2 快捷键跳转到上/下一个书签
  const [isLayerProcessing, setIsLayerProcessing] = React.useState(false);

  // ===== 工作区持久化 (Workspace Config Persistence) =====
  // 自动将当前打开的文件和图层配置保存到本地磁盘（.loglayer 目录）。
  useWorkspaceConfig({
    workspaceRoot,
    files,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFilePath: activeFile?.path,
    handleFileActivate
  });

  // 导航到下一个搜索匹配项，并自动滚动到底部/指定行
  const findNextSearchMatchWithJump = useCallback(async (direction: 'next' | 'prev', overrideMatchCount?: number) => {
    // Use overrideMatchCount if provided (from onPipelineFinished callback), otherwise get from cache
    const matchCount = overrideMatchCount ?? processedCache[activeFileId ?? '']?.searchMatchCount ?? 0;

    // [OPTIMIZATION] Nearest neighbor jumping
    // If we have a highlighted index (user click or previous jump), we find the match nearest to it.
    // If no highlighted index, use 0 (start from beginning to find nearest)
    const startIndex = highlightedIndex !== null ? highlightedIndex : 0;
    const nextIdx = await findNextSearchMatch(direction, startIndex, matchCount);
    if (nextIdx !== -1) {
      handleJumpToLine(nextIdx, activeFile?.lineCount || 0);
    }
  }, [findNextSearchMatch, handleJumpToLine, activeFile?.lineCount, highlightedIndex, processedCache, activeFileId]);

  // 增强版：激活文件，并确保其在后端也处于同步状态
  const handleFileActivateWithLoad = useCallback((fileId: string) => {
    handleFileActivate(fileId);
  }, [handleFileActivate]);

  // ===== 桥接层集成 (Bridge Integration) =====
  // 监听来自 Python 后端的信号（文件加载完成、搜索完成、统计完成等）。
  const { bridgeApi, activeFileIdRef, setActiveFileId: setBridgeActiveFileId } = useBridge({
    // 当后端成功解析并建立文件索引后触发
    onFileLoaded: (fileId: string, info: FileLoadedInfo) => {
      // [BUG FIX] Sanitization: Check if the file is still supposed to be open
      setFiles(prev => {
        const existingIndex = prev.findIndex(f => f.id === fileId);

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
            path: info.path || oldFile.path
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
            history: { past: [], future: [] }
          };
          setTimeout(() => setActiveFileId(fileId), 0);
          return [...prev, newFile];
        }
      });

      // Only clear loading state when NOT a partial load
      if (!info.partial) {
        triggerUpdate();
        setIsProcessing(false);
        setOperationStatus(null);
        markFileLoaded(fileId);
        setIndexingFileIds(prev => removeFromSet(prev, fileId));
      } else {
        // Partial load: keep indexing in progress, but allow viewing
        triggerUpdate();
        setLoadingProgress(10);  // Show some progress
      }
    },

    // 当后端 Pipeline 运行结束（过滤/搜索合并）后触发
    onPipelineFinished: (fileId, newTotal, matchCount) => {
      setBridgedCount(fileId, newTotal);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, lineCount: newTotal } : f));
      setProcessedCache(prev => {
        const newCache = { ...prev };
        newCache[fileId] = {
          ...(prev[fileId] || {}),
          searchMatchCount: matchCount
        } as ProcessedCache;
        return newCache;
      });
      triggerUpdate();

      if (activeFileIdRef.current === fileId) {
        setOperationStatus(null);
        setIsProcessing(false);
        setIsSearching(false);
        setIndexingFileIds(prev => removeFromSet(prev, fileId));

        // [BUG FIX 3] Nearest jumping after search finishes
        // If we are in searching mode and no rank is selected yet, jump to the nearest!
        if (searchQuery && matchCount > 0 && currentMatchRank === -1) {
          // Use a tiny timeout to let React finish the current state update cycle (setProcessedCache)
          // so the subsequent findNextSearchMatchWithJump sees the correct matchCount.
          setTimeout(() => {
            findNextSearchMatchWithJump('next', matchCount);
          }, 0);
        }
      }
    },

    // 当后端各图层统计数据计算完成后触发
    onStatsFinished: (fileId, stats) => {
      setProcessedCache(prev => {
        const newCache = { ...prev };
        newCache[fileId] = {
          ...(prev[fileId] || { layerStats: {}, searchMatchCount: 0 }),
          layerStats: { ...prev[fileId]?.layerStats, ...stats }
        };
        return newCache;
      });
    },

    // 监听各种后台任务的进度（Indexing, Pipeline, Searching 等）
    onOperationStarted: (fileId, op) => {
      if (op === 'indexing') {
        setIndexingFileIds(prev => new Set(prev).add(fileId));
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
        setIndexingFileIds(prev => removeFromSet(prev, fileId));
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
    }
  });

  // 保持 bridge 层的引用与当前激活文件一致
  useEffect(() => {
    setBridgeActiveFileId(activeFileId);
  }, [activeFileId, setBridgeActiveFileId]);

  // 为侧边栏 UnifiedPanel 准备文件列表信息
  const fileInfoList: FileInfo[] = useMemo(() =>
    files.map(f => ({
      id: f.id,
      name: f.name,
      size: f.size,
      isActive: f.id === activeFileId,
      lineCount: f.lineCount,
      layers: f.layers
    })), [files, activeFileId]);

  // 导航到下一个搜索匹配项，并自动滚动到底部/指定行已被移动到上方

  // ===== 远程路径选择器 (Remote Path Picker) =====
  // 用于 --no-ui 模式下替代原生文件对话框
  const remotePathPicker = useRemotePathPicker();
  const {
    isOpen: isRemotePickerOpen,
    mode: remotePickerMode,
    listDirectory: remoteListDirectory,
    onSelect: handleRemotePathSelect,
    onOpenChange: setRemotePickerOpen
  } = remotePathPicker;

  // 远程选择器的确认回调
  const [remotePickerCallback, setRemotePickerCallback] = useState<((result: { path: string; isDir: boolean }) => void) | null>(null);

  // 打开远程统一选择器
  const openRemotePicker = useCallback((callback: (result: { path: string; isDir: boolean }) => void) => {
    setRemotePickerCallback(() => callback);
    remotePathPicker.openPathPicker();
  }, [remotePathPicker]);

  // 处理远程选择器结果
  const handleRemotePathSelected = useCallback((path: string, isDir: boolean) => {
    handleRemotePathSelect(path, isDir);
    if (remotePickerCallback) {
      remotePickerCallback({ path, isDir });
      setRemotePickerCallback(null);
    }
  }, [handleRemotePathSelect, remotePickerCallback]);

  // 处理远程选择器关闭
  const handleRemotePickerClose = useCallback((open: boolean) => {
    setRemotePickerOpen(open);
    if (!open) {
      setRemotePickerCallback(null);
    }
  }, [setRemotePickerOpen]);

  // 处理统一打开逻辑 (文件或项目)
  const handleOpen = useCallback(async () => {
    // 优先尝试原生对话框（如果支持同时选文件和文件夹，但目前 bridge 分开，所以逻辑上先尝试原生文件夹选择）
    // 实际上更优雅的方式是根据 hasNativeDialogs 直接分流
    const hasDialogs = await hasNativeDialogs();

    if (hasDialogs) {
      // 原生模式下目前仍保持分开或弹出选择（由于 bridge 系统限制）
      // 这里简道起见，或者调用原生 select_folder 做演示，后续可深度整合 bridge
      const result = await handleNativeFolderSelect();
      if (result) {
        setWorkspaceRoot(result);
      }
    } else {
      // 远程模式：使用通用的 openPathPicker
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
    }
  }, [handleNativeFolderSelect, setWorkspaceRoot, openRemotePicker, handleOpenFileByPath]);

  // ===== 命令面板 (Command Palette) =====
  const commands = useAppCommands({
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
    activeFileName: activeFile?.name
  });

  useKeyboardShortcuts({
    handleToggleWatch,
    setIsSettingsVisible,
    setIsCommandPaletteVisible,
    splitPane,
    removePane,
    activePaneId,
    panes
  });

  return (
    <div
      role="application"
      aria-label="LogLayer"
      className="flex flex-col h-screen select-none overflow-hidden text-sm bg-theme-base text-primary"
      onDragOver={(e) => {
        // 关键修复：防止浏览器默认的拖拽操作（如直接打开文件）
        // 这样组件内部的 Drop 区域才能正常工作。
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
    >
      <FileInputs
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        onFileUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
      />

      {/* 顶部标题栏 */}
      <AppHeader
        fileName={fileName}
        isProcessing={isProcessing}
        fileCount={files.length}
      />

      <ProgressBar
        isProcessing={isProcessing}
        isLayerProcessing={isLayerProcessing}
        loadingProgress={loadingProgress}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧侧边栏按钮（Explorer, Search, Help） */}
        <Sidebar 
          activeView={activeView} 
          onSetActiveView={setActiveView} 
          onOpenSettings={() => setIsSettingsVisible(true)}
          isWatching={isWatching}
          onToggleWatch={handleToggleWatch}
          hasNewContent={hasNewContent}
        />

        <SidebarContainer
          sidebarWidth={sidebarWidth}
          setSidebarWidth={setSidebarWidth}
          responsive={responsive}
        >
          <SidebarPanel
            activeView={activeView}
            workspaceRoot={workspaceRoot}
            fileInfoList={fileInfoList}
            activeFileId={activeFileId}
            layers={layers}
            layerStats={layerStats}
            selectedLayerId={selectedLayerId}
            presets={presets}
            saveStatus={saveStatus}
            canUndo={canUndo}
            canRedo={canRedo}
            bookmarks={bookmarks}
            bookmarkPreviews={bookmarkPreviews}
            logLevelStats={logLevelStats}
            fileId={activeFileId}
            onOpen={handleOpen}
            onOpenFileByPath={handleOpenFileByPath}
            onFileActivate={handleFileActivateWithLoad}
            onFileRemove={handleFileRemove}
            onSelectLayer={setSelectedLayerId}
            onLayerDrop={handleDrop}
            onLayerRemove={(id) => updateLayers(prev => prev.filter(l => l.id !== id && l.groupId !== id))}
            onLayerToggle={(id) => updateLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l))}
            onLayerUpdate={(id: string, update: any) => updateLayers(prev => prev.map((l: any) => l.id === id ? { ...l, ...update } : l))}
            onAddLayer={addLayer}
            onJumpToLine={(idx) => handleJumpToLine(idx, activeFile?.lineCount || 0)}
            onPresetApply={(p: any) => updateLayers(JSON.parse(JSON.stringify(p.layers)))}
            onPresetDelete={(id) => {
              const next = presets.filter(p => p.id !== id);
              setPresets(next);
              localStorage.setItem('loglayer_presets', JSON.stringify(next));
            }}
            onPresetSave={handleSavePreset}
            onUndo={undo}
            onRedo={redo}
            onToggleBookmark={handleToggleBookmark}
            onClearBookmarks={handleClearBookmarks}
            onJumpToBookmark={(idx) => handleJumpToBookmark(idx, (visualIdx) => handleJumpToLine(visualIdx, activeFile?.lineCount || 0))}
            onAiPanelClose={() => { setActiveView('main'); setAiPanelInitialContent(''); }}
            onAiPanelInitialContent={aiPanelInitialContent}
            onApplyAiSuggestion={(type, value) => {
              if (type === 'filter') {
                addLayer(LayerType.FILTER, { query: value });
              } else if (type === 'highlight') {
                addLayer(LayerType.HIGHLIGHT, { query: value, color: '#facc15' });
              }
            }}
            onQuickFilter={(levels) => {
              const existingLevelLayer = layers.find(l => l.type === LayerType.LEVEL);
              if (existingLevelLayer) {
                updateLayers([{ ...existingLevelLayer, config: { ...existingLevelLayer.config, levels } }]);
              } else {
                addLayer(LayerType.LEVEL, { levels, preset: 'custom' });
              }
            }}
            onApplyPatternSuggestion={(suggestion: any) => {
              if (suggestion.type === 'time') {
                addLayer(LayerType.TIME_RANGE, {});
              } else if (suggestion.type === 'level') {
                addLayer(LayerType.LEVEL, { preset: 'custom' });
              } else if (suggestion.type === 'json_tree') {
                showNotification('JSON 日志已启用 - 右键点击日志行查看树形视图', 'info');
              } else if (suggestion.type === 'bookmark') {
                showNotification('建议：使用书签标记堆栈跟踪位置', 'info');
              }
            }}
            showNotification={showNotification}
            updateLayers={(updater: (layers: unknown[]) => unknown) => {
                if (typeof updater === 'function') {
                    updateLayers((prev) => updater(prev) as typeof prev);
                } else {
                    updateLayers(updater as never);
                }
            }}
            activeFile={activeFile}
          />
        </SidebarContainer>

        <MainContent
          activeView={activeView}
          isFindVisible={isFindVisible}
          isGoToLineVisible={isGoToLineVisible}
          searchQuery={searchQuery}
          searchConfig={searchConfig}
          searchMatchCount={searchMatchCount}
          currentMatchNumber={currentMatchNumber}
          searchMode={searchMode}
          activeFile={activeFile}
          activeFileId={activeFileId}
          processedCache={processedCache}
          setSearchQuery={setSearchQuery}
          setSearchConfig={setSearchConfig}
          findNextSearchMatchWithJump={findNextSearchMatchWithJump}
          setSearchMode={setSearchMode}
          handleJumpToLine={handleJumpToLine}
          setIsFindVisible={setIsFindVisible}
          setIsGoToLineVisible={setIsGoToLineVisible}
          clearSearch={clearSearch}
          setProcessedCache={setProcessedCache}
          panes={panes}
          files={files}
          activePaneId={activePaneId}
          scrollToIndex={scrollToIndex}
          highlightedIndex={highlightedIndex}
          setHighlightedIndex={setHighlightedIndex}
          loadingFileIds={loadingFileIds}
          indexingFileIds={indexingFileIds}
          pendingCliFiles={pendingCliFiles}
          bridgedUpdateTrigger={bridgedUpdateTrigger}
          settings={settings}
          resolvedTheme={resolvedTheme}
          hasNewContent={hasNewContent}
          setActivePaneId={setActivePaneId}
          addLayer={addLayer}
          handleToggleBookmark={handleToggleBookmark}
          handleUpdateBookmarkComment={handleUpdateBookmarkComment}
          setCanvasSelectedText={setCanvasSelectedText}
          setAiPanelInitialContent={setAiPanelInitialContent}
          setActiveView={setActiveView}
          clearNewContent={clearNewContent}
          setScrollToIndex={setScrollToIndex}
          removePane={removePane}
          handleOpen={handleOpen}
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
        currentLine={(highlightedIndex !== null) ? highlightedIndex + 1 : undefined}
        pendingCliFiles={pendingCliFiles}
        isWatching={isWatching}
        hasNewContent={hasNewContent}
        paneCount={panes.length}
        maxPanes={MAX_PANES}
        onOpenSettings={() => setIsSettingsVisible(true)}
        onOpenShortcuts={() => setIsShortcutsVisible(true)}
      />

      <AppModals
        isRemotePickerOpen={isRemotePickerOpen}
        remotePickerMode={remotePickerMode}
        listDirectory={remoteListDirectory}
        handleRemotePickerClose={handleRemotePickerClose}
        handleRemotePathSelected={handleRemotePathSelected}
        commands={commands}
        isCommandPaletteVisible={isCommandPaletteVisible}
        setIsCommandPaletteVisible={setIsCommandPaletteVisible}
        isSettingsVisible={isSettingsVisible}
        setIsSettingsVisible={setIsSettingsVisible}
        isShortcutsVisible={isShortcutsVisible}
        setIsShortcutsVisible={setIsShortcutsVisible}
        notification={notification}
        isExportDialogOpen={isExportDialogOpen}
        onCloseExportDialog={() => setIsExportDialogOpen(false)}
        exportFileId={activeFileId || ''}
        exportFileName={activeFile?.name || ''}
        onExport={async (options) => {
          const { exportVisibleLines } = await import('./bridge_client');
          await exportVisibleLines(options);
          setNotification({ message: '导出成功', type: 'success' });
        }}
        isStorageSettingsOpen={isStorageSettingsOpen}
        onCloseStorageSettings={() => setIsStorageSettingsOpen(false)}
        storageDefaultPath={''}
        onStoragePathChange={(path) => console.log('Storage path:', path)}
        isWorkerConfigOpen={isWorkerConfigOpen}
        onCloseWorkerConfig={() => setIsWorkerConfigOpen(false)}
        onWorkerConfigChange={(maxWorkers) => console.log('Worker config:', maxWorkers)}
        isPluginManagerOpen={isPluginManagerOpen}
        onClosePluginManager={() => setIsPluginManagerOpen(false)}
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
