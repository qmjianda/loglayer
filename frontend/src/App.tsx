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
import { PaneHeader } from './components/common/PaneHeader';
import { SplitPaneContainer } from './components/common/SplitPaneContainer';
import { PaneResizeHandle } from './components/common/PaneResizeHandle';


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
  // 负责管理分屏布局、拖放操作、分屏创建等
  const paneManagement = usePaneManagement(
    panes,
    setPanes,
    activePaneId,
    setActivePaneId,
    files,
    setActiveFileId
  );
  const {
    dragOverState,
    setDragOverState,
    isDragging,
    setIsDragging,
    draggedFileId,
    setDraggedFileId,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop: handlePaneDrop,
    splitPane,
    removePane,
    layout,
    setLayout,
    paneSizes,
    setPaneSizes,
    updatePaneSize,
    resetPaneSizes
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

  // Persist pane layout and sizes
  const PANE_STORAGE_KEY = 'loglayer-pane-layout';
  
  React.useEffect(() => {
    const saved = localStorage.getItem(PANE_STORAGE_KEY);
    if (saved) {
      try {
        const { layout: savedLayout, sizes: savedSizes } = JSON.parse(saved);
        if (savedLayout) setLayout(savedLayout);
        if (savedSizes) setPaneSizes(savedSizes);
      } catch (e) {
        console.warn('[App] Failed to restore pane layout:', e);
      }
    }
  }, []);

  React.useEffect(() => {
    const data = JSON.stringify({ layout, sizes: paneSizes });
    localStorage.setItem(PANE_STORAGE_KEY, data);
  }, [layout, paneSizes]);

  // 导航到下一个搜索匹配项，并自动滚动到底部/指定行
  const findNextSearchMatchWithJump = useCallback(async (direction: 'next' | 'prev') => {
    // [OPTIMIZATION] Nearest neighbor jumping
    // If we have a highlighted index (user click or previous jump), we find the match nearest to it.
    const nextIdx = await findNextSearchMatch(direction, highlightedIndex);
    if (nextIdx !== -1) {
      handleJumpToLine(nextIdx, activeFile?.lineCount || 0);
    }
  }, [findNextSearchMatch, handleJumpToLine, activeFile?.lineCount, highlightedIndex]);

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
            findNextSearchMatchWithJump('next');
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
  const commands: Command[] = [
    { id: 'file.open', label: '打开文件', shortcut: 'Ctrl+O', category: '文件', action: handleOpen },
    { id: 'file.openFolder', label: '打开文件夹', shortcut: 'Ctrl+Shift+O', category: '文件', action: handleNativeFolderSelect },
    { id: 'search.focus', label: '聚焦搜索', shortcut: 'Ctrl+F', category: '搜索', action: () => setIsFindVisible(true) },
    { id: 'search.next', label: '下一个匹配', shortcut: 'F3', category: '搜索', action: () => findNextSearchMatchWithJump('next') },
    { id: 'search.prev', label: '上一个匹配', shortcut: 'Shift+F3', category: '搜索', action: () => findNextSearchMatchWithJump('prev') },
    { id: 'goto.line', label: '跳转到行', shortcut: 'Ctrl+G', category: '导航', action: () => setIsGoToLineVisible(true) },
    { id: 'view.main', label: '主视图', category: '视图', action: () => setActiveView('main') },
    { id: 'view.search', label: '搜索视图', category: '视图', action: () => setActiveView('search') },
    { id: 'view.ai', label: 'AI 助手', category: '视图', action: () => setActiveView('ai') },
    { id: 'view.stats', label: '统计面板', category: '视图', action: () => setActiveView('stats') },
    { id: 'view.help', label: '帮助视图', category: '视图', action: () => setActiveView('help') },
    { id: 'pane.splitRight', label: '向右分屏', shortcut: 'Ctrl+\\ | Ctrl+Shift+→', category: '分屏', action: () => splitPane(activePaneId, undefined, 'right'), enabled: panes.length < MAX_PANES },
    { id: 'pane.splitBottom', label: '向下分屏', shortcut: 'Ctrl+Shift+\\ | Ctrl+Shift+↓', category: '分屏', action: () => splitPane(activePaneId, undefined, 'bottom'), enabled: panes.length < MAX_PANES },
    { id: 'pane.close', label: '关闭当前分屏', shortcut: 'Ctrl+W', category: '分屏', action: () => removePane(activePaneId), enabled: panes.length > 1 },
    { id: 'pane.layoutHorizontal', label: '水平布局', shortcut: '', category: '分屏', action: () => { setLayout('horizontal'); resetPaneSizes(); }, enabled: panes.length > 1 },
    { id: 'pane.layoutVertical', label: '垂直布局', shortcut: '', category: '分屏', action: () => { setLayout('vertical'); resetPaneSizes(); }, enabled: panes.length > 1 },
    { id: 'pane.layoutGrid', label: '网格布局 (2x2)', shortcut: '', category: '分屏', action: () => { setLayout('grid'); resetPaneSizes(); }, enabled: panes.length > 1 && panes.length <= 4 },
    { id: 'pane.resetSizes', label: '重置分屏大小', shortcut: '', category: '分屏', action: () => resetPaneSizes() },
    { id: 'layer.new', label: '新建图层', shortcut: 'Ctrl+Shift+L', category: '图层', action: () => {
      // 添加一个默认的高亮图层
      addLayer(LayerType.HIGHLIGHT, { query: '', color: '#fbbf24', enabled: true });
    }},
    { id: 'bookmark.export', label: '导出书签', category: '书签', action: () => {
      // 导出书签为 JSON 文件
      if (activeFileId && bookmarks[activeFileId]) {
        const fileBookmarks = bookmarks[activeFileId];
        const exportData = {
          file: activeFile?.name,
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
        a.download = `${activeFile?.name || 'bookmarks'}_bookmarks.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }},
    { id: 'settings.open', label: '打开设置', shortcut: 'Ctrl+,', category: '设置', action: () => setIsSettingsVisible(true) },
  ];

  // 命令面板快捷键监听 - 放在 useUIState 之后
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isP = e.key.toLowerCase() === 'p';
      const isT = e.key.toLowerCase() === 't';
      const isComma = e.key === ',';
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Ctrl+Shift+P: 命令面板
      if (isCmdOrCtrl && isP && isShift) {
        e.preventDefault();
        setIsCommandPaletteVisible(true);
      }

      // Ctrl+Shift+T: 文件监视
      if (isCmdOrCtrl && isT && isShift) {
        e.preventDefault();
        handleToggleWatch();
      }

      // Ctrl+,: 设置
      if (isCmdOrCtrl && isComma) {
        e.preventDefault();
        setIsSettingsVisible(true);
      }

      // Ctrl+\\: 向右分屏
      if (isCmdOrCtrl && e.key === '\\' && !isShift) {
        e.preventDefault();
        if (panes.length < 4) {
          splitPane(activePaneId, undefined, 'right');
        }
      }

      // Ctrl+Shift+\\: 向下分屏
      if (isCmdOrCtrl && e.key === '\\' && isShift) {
        e.preventDefault();
        if (panes.length < 4) {
          splitPane(activePaneId, undefined, 'bottom');
        }
      }

      // Ctrl+Shift+→: 向右分屏 (备用快捷键)
      if (isCmdOrCtrl && isShift && e.key === 'ArrowRight') {
        e.preventDefault();
        if (panes.length < 4) {
          splitPane(activePaneId, undefined, 'right');
        }
      }

      // Ctrl+Shift+↓: 向下分屏 (备用快捷键)
      if (isCmdOrCtrl && isShift && e.key === 'ArrowDown') {
        e.preventDefault();
        if (panes.length < 4) {
          splitPane(activePaneId, undefined, 'bottom');
        }
      }

      // Ctrl+W: 关闭当前分屏
      if (isCmdOrCtrl && e.key === 'w' && !isShift) {
        e.preventDefault();
        if (panes.length > 1) {
          removePane(activePaneId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleWatch, setIsSettingsVisible, setIsCommandPaletteVisible]);

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
        // @ts-ignore - webkitdirectory 是非标准属性，用于选择目录
        webkitdirectory=""
        directory=""
        multiple
      />

      {/* 顶部标题栏 */}
      <div className="h-9 bg-tertiary flex items-center px-4 border-b border-subtle shrink-0 justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-blue-400 font-black tracking-tighter flex items-center cursor-default">
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5-10-5zM2 17l10 5 10-5-10-5-10 5zM2 12l10 5 10-5-10-5-10 5z" /></svg>
            LogLayer
          </span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
          {fileName || (isProcessing ? '正在解析文件...' : '就绪')}
          {files.length > 1 && ` (+${files.length - 1})`}
        </div>
      </div>

      {/* 顶部进度条 - 使用绝对定位防止布局跳动 */}
      <div className="absolute top-9 left-0 right-0 h-0.5 z-50 pointer-events-none">
        {(isProcessing || isLayerProcessing) && (
          <div className={`h-full bg-blue-500 transition-all duration-300 ${isLayerProcessing ? 'animate-pulse' : ''}`}
            style={{ width: isLayerProcessing ? '100%' : `${loadingProgress}%` }} />
        )}
      </div>

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

        {/* 侧边栏面板容器 */}
        <div
          className={`bg-secondary border-r border-subtle flex flex-col shrink-0 shadow-lg relative group/sidebar 
            ${responsive.isMobile ? 'absolute inset-y-0 left-10 z-40' : ''}`}
          style={{ 
            width: responsive.isMobile ? (sidebarWidth > 0 ? sidebarWidth : 280) : sidebarWidth,
            display: responsive.isMobile && sidebarWidth === 0 ? 'none' : 'flex'
          }}
        >
          {/* 拖拽调整宽度的 Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors opacity-0 group-hover/sidebar:opacity-100"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = sidebarWidth;
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const newWidth = Math.max(200, Math.min(600, startWidth + (moveEvent.clientX - startX)));
                setSidebarWidth(newWidth);
              };
              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />

          {/* 资源管理器视图：包含文件树和图层管理 */}
          {activeView === 'main' && (
            <UnifiedPanel
              workspaceRoot={workspaceRoot}
              onOpenFileByPath={handleOpenFileByPath}
              files={fileInfoList}
              activeFileId={activeFileId}
              onOpen={handleOpen}
              onFileActivate={handleFileActivateWithLoad}
              onFileRemove={handleFileRemove}
              layers={layers}
              layerStats={layerStats}
              selectedLayerId={selectedLayerId}
              fileId={activeFileId}
              onSelectLayer={setSelectedLayerId}
              onLayerDrop={(draggedId, targetId, position) => {
                handleDrop(draggedId, targetId, position);
              }}
              onLayerRemove={(id) => updateLayers(prev => prev.filter(l => l.id !== id && l.groupId !== id))}
              onLayerToggle={(id) => updateLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l))}
              onLayerUpdate={(id, update) => updateLayers(prev => prev.map(l => l.id === id ? { ...l, ...update } : l))}
              onAddLayer={addLayer}
              onJumpToLine={(idx) => handleJumpToLine(idx, activeFile?.lineCount || 0)}
              presets={presets}
              onPresetApply={(p) => updateLayers(JSON.parse(JSON.stringify(p.layers)))}
              onPresetDelete={(id) => {
                const next = presets.filter(p => p.id !== id);
                setPresets(next);
                localStorage.setItem('loglayer_presets', JSON.stringify(next));
              }}
              onPresetSave={handleSavePreset}
              saveStatus={saveStatus}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              bookmarkRefreshTrigger={0} // Legacy, not used with useBookmarks hook
              bookmarks={bookmarks}
              bookmarkPreviews={bookmarkPreviews}
              onToggleBookmark={handleToggleBookmark}
              onClearBookmarks={handleClearBookmarks}
              onJumpToBookmark={(idx) => handleJumpToBookmark(idx, (visualIdx) => handleJumpToLine(visualIdx, activeFile?.lineCount || 0))}
            />
          )}

          {/* 全局搜索视图 */}
          {activeView === 'search' && (
            <SearchPanel
              onSearch={setSearchQuery}
              config={searchConfig}
              setConfig={setSearchConfig}
              matchCount={searchMatchCount}
              onNavigate={findNextSearchMatchWithJump}
              currentIndex={currentMatchNumber}
            />
          )}

          {/* AI 助手视图 */}
          {activeView === 'ai' && (
            <AIChatPanel 
              initialContent={aiPanelInitialContent}
              onClose={() => { setActiveView('main'); setAiPanelInitialContent(''); }}
              onApplySuggestion={(type, value) => {
                if (type === 'filter') {
                  addLayer(LayerType.FILTER, { query: value });
                } else if (type === 'highlight') {
                  addLayer(LayerType.HIGHLIGHT, { query: value, color: '#facc15' });
                }
              }}
            />
          )}

          {/* 统计视图 */}
          {activeView === 'stats' && (
            <div className="flex-1 overflow-auto">
              <StatsPanel 
                stats={logLevelStats}
                total={activeFile?.lineCount || 0}
                onQuickFilter={(levels) => {
                  // Apply level filter via layer
                  const existingLevelLayer = layers.find(l => l.type === LayerType.LEVEL);
                  if (existingLevelLayer) {
                    updateLayers([{ ...existingLevelLayer, config: { ...existingLevelLayer.config, levels } }]);
                  } else {
                    addLayer(LayerType.LEVEL, { levels, preset: 'custom' });
                  }
                }}
              />
              <PatternAnalysisPanel 
                fileId={activeFileId}
                onApplySuggestion={(suggestion) => {
                  // Apply layer suggestion
                  if (suggestion.type === 'time') {
                    addLayer(LayerType.TIME_RANGE, {});
                  } else if (suggestion.type === 'level') {
                    addLayer(LayerType.LEVEL, { preset: 'custom' });
                  } else if (suggestion.type === 'json_tree') {
                    // JSON tree is handled by right-click menu
                    showNotification('JSON 日志已启用 - 右键点击日志行查看树形视图', 'info');
                  } else if (suggestion.type === 'bookmark') {
                    showNotification('建议：使用书签标记堆栈跟踪位置', 'info');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* 主内容区域：显示日志视图或帮助文档 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-theme-base relative select-text overflow-hidden">
          {activeView === 'help' ? (
            <HelpPanel />
          ) : (
            <>
              {/* 悬浮组件：Ctrl+F 查找搜索框 */}
              {isFindVisible && (
                <EditorFindWidget
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  config={searchConfig}
                  onConfigChange={setSearchConfig}
                  matchCount={searchMatchCount}
                  currentMatch={currentMatchNumber}
                  onNavigate={findNextSearchMatchWithJump}
                  searchMode={searchMode}
                  onSearchModeChange={setSearchMode}
                  onClose={() => {
                    setIsFindVisible(false);
                    clearSearch();
                    if (activeFileId) {
                      setProcessedCache(prev => {
                        const newCache = { ...prev };
                        newCache[activeFileId] = {
                          ...(prev[activeFileId] || { layerStats: {}, searchMatchCount: 0 }),
                          searchMatchCount: 0
                        };
                        return newCache;
                      });
                    }
                  }}
                />
              )}

              {/* 悬浮组件：Ctrl+G 跳转行号 */}
              {isGoToLineVisible && (
                <EditorGoToLineWidget
                  totalLines={activeFile?.lineCount || 0}
                  onGo={(lineNum) => {
                    handleJumpToLine(lineNum - 1, activeFile?.lineCount || 0);
                    setIsGoToLineVisible(false);
                  }}
                  onClose={() => setIsGoToLineVisible(false)}
                />
              )}

              {/* 中间编辑器区域（支持分屏，拖放文件到分屏位置实现多文件同时查看） */}
              <div className={`flex-1 overflow-hidden min-w-0 min-h-0 ${isDragging ? 'cursor-move' : ''} ${
                layout === 'grid' 
                  ? 'grid' 
                  : layout === 'vertical' 
                    ? 'flex-col' 
                    : 'flex'
              }`}
              style={layout === 'grid' ? { gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' } : undefined}>
                {panes.map((pane, index) => {
                  const paneFileId = pane.fileId;
                  const paneFile = files.find(f => f.id === paneFileId);
                  const processedData = paneFileId ? processedCache[paneFileId] : null;
                  const paneStats = processedData?.layerStats || {};
                  const isPaneActive = activePaneId === pane.id;

                  const paneSize = paneSizes[pane.id];

                  return (
                    <React.Fragment key={pane.id}>
                      {index > 0 && layout === 'horizontal' && panes.length > 1 && (
                        <PaneResizeHandle
                          direction="horizontal"
                          index={index}
                          totalPanes={panes.length}
                          onResize={(delta) => {
                            const container = document.querySelector('.flex-1.flex.overflow-hidden') as HTMLElement | null;
                            const containerWidth = container?.offsetWidth || 1;
                            const percentageDelta = (delta / containerWidth) * 100;
                            const prevPane = panes[index - 1];
                            const prevSize = paneSizes[prevPane.id] || 50;
                            updatePaneSize(prevPane.id, prevSize + percentageDelta);
                          }}
                        />
                      )}
                      {index > 0 && layout === 'vertical' && panes.length > 1 && (
                        <PaneResizeHandle
                          direction="vertical"
                          index={index}
                          totalPanes={panes.length}
                          onResize={(delta) => {
                            const container = document.querySelector('.flex-1.flex.overflow-hidden') as HTMLElement | null;
                            const containerHeight = container?.offsetHeight || 1;
                            const percentageDelta = (delta / containerHeight) * 100;
                            const prevPane = panes[index - 1];
                            const prevSize = paneSizes[prevPane.id] || 50;
                            updatePaneSize(prevPane.id, prevSize + percentageDelta);
                          }}
                        />
                      )}
                      <SplitPaneContainer
                        paneId={pane.id}
                        isActive={isPaneActive}
                        dragOverState={dragOverState}
                        isDragging={isDragging}
                        onDragOver={(e, position) => handleDragOver(e, pane.id, position)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e, position) => handlePaneDrop(e, pane.id, position)}
                        className="bg-primary relative border-r border-subtle overflow-hidden"
                        style={layout !== 'grid' && paneSize ? { flex: `0 0 ${paneSize}%` } : undefined}
                      >
                      {/* 文件标签栏（支持拖放） */}
                      <PaneHeader
                        file={paneFile}
                        paneId={pane.id}
                        isActive={isPaneActive}
                        isDragging={isDragging && draggedFileId === paneFileId}
                        onClose={panes.length > 1 ? () => removePane(pane.id) : undefined}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onClick={() => setActivePaneId(pane.id)}
                      />

                      {/* 核心组件：日志查看器 */}
                      <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
                        {paneFileId ? (
                          <>
                            {/* [BUG FIX] Mutually exclusive rendering and state reset:
                                1. Use loadingFileIds and indexingFileIds for this SPECIFIC pane's file.
                                2. Add key={paneFileId} to force remount on file switch. 
                                   This resets LogViewer internal states like scrolling and cache. */}
                            {(loadingFileIds.has(paneFileId) || indexingFileIds.has(paneFileId)) ? (
                              <FileLoadingSkeleton fileName={paneFile?.name} />
                            ) : (
                              <LogViewer
                                key={paneFileId}
                                totalLines={paneFile?.lineCount || 0}
                                fileId={pane.fileId}
                                searchQuery={(isFindVisible || activeView === 'search') ? searchQuery : ''}
                                searchConfig={searchConfig}
                                scrollToIndex={isPaneActive ? scrollToIndex : null}
                                highlightedIndex={isPaneActive ? highlightedIndex : null}
                                onLineClick={(idx) => {
                                  if (!isPaneActive) setActivePaneId(pane.id);
                                  setHighlightedIndex(idx);
                                }}
                                onAddLayer={(type, config) => addLayer(type, config)}
                                onToggleBookmark={handleToggleBookmark}
                                onUpdateBookmarkComment={handleUpdateBookmarkComment}
                                onSelectedTextChange={setCanvasSelectedText}
                                onSendToAI={(text) => { setAiPanelInitialContent(text); setActiveView('ai'); }}
                                updateTrigger={bridgedUpdateTrigger}
                                settings={settings}
                                resolvedTheme={resolvedTheme}
                                hasNewContent={hasNewContent}
                                onScrollToNewContent={() => {
                                  clearNewContent();
                                  if (activeFile?.lineCount) {
                                    setScrollToIndex(activeFile.lineCount - 1);
                                  }
                                }}
                              />
                            )}
                          </>
                        ) : pendingCliFiles > 0 ? (
                          // CLI 待处理文件占位
                          <PendingFilesWall count={pendingCliFiles} />
                        ) : (
                          // 无文件时的欢迎界面
                          <div
                            className={`flex-1 flex flex-col items-center justify-center text-gray-600 bg-theme-base cursor-pointer transition-colors ${
                              isDragging ? 'bg-blue-500/10 border-2 border-dashed border-blue-400' : 'hover:bg-theme-surface'
                            }`}
                            onClick={handleOpen}
                          >
                            {isDragging ? (
                              <>
                                <svg className="w-12 h-12 mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-sm font-medium text-blue-400">拖放到此处打开文件</p>
                              </>
                            ) : (
                              <>
                                <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <p className="text-sm font-medium">将日志文件拖拽至此处打开</p>
                                <p className="text-xs mt-2 opacity-60">或点击浏览并打开文件/文件夹</p>
                                
                                {/* 分屏功能引导 */}
                                <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-300/30 max-w-xs">
                                  <p className="text-xs font-semibold text-blue-400 mb-3">💡 分屏功能</p>
                                  <ul className="text-xs space-y-2 text-muted">
                                    <li className="flex items-start gap-2">
                                      <span className="text-blue-400 mt-0.5">•</span>
                                      <span>拖动文件标签到窗口边缘创建分屏</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                      <span className="text-blue-400 mt-0.5">•</span>
                                      <span>快捷键 <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+\</kbd> 向右分屏</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                      <span className="text-blue-400 mt-0.5">•</span>
                                      <span>快捷键 <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+Shift+\</kbd> 向下分屏</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                      <span className="text-blue-400 mt-0.5">•</span>
                                      <span>最多支持 4 个分屏</span>
                                    </li>
                                  </ul>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </SplitPaneContainer>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}
        </div>
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

      {/* 远程路径选择器 - 用于 --no-ui 模式替代原生对话框 */}
      <RemotePathPicker
        open={isRemotePickerOpen}
        onOpenChange={handleRemotePickerClose}
        onSelect={handleRemotePathSelected}
        mode={remotePickerMode}
        title={remotePickerMode === 'folder' ? '选择文件夹' : remotePickerMode === 'file' ? '选择文件' : '选择路径'}
        listDirectory={remoteListDirectory}
      />

      {/* 命令面板 */}
      <CommandPalette
        commands={commands}
        isOpen={isCommandPaletteVisible}
        onClose={() => setIsCommandPaletteVisible(false)}
      />

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />

      {/* 快捷键参考面板 */}
      <KeyboardShortcutsPanel
        isOpen={isShortcutsVisible}
        onClose={() => setIsShortcutsVisible(false)}
      />

      {/* 通知 Toast */}
      {notification && (
        <div className="fixed bottom-16 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg border ${
            notification.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
            notification.type === 'warning' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' :
            notification.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
            'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}>
            <div className="text-sm font-medium">{notification.message}</div>
          </div>
        </div>
      )}
      
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
