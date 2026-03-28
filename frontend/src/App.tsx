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
import { AppHeader } from './components/AppHeader';
import { useAppCommands } from './components/AppCommands';
import { SidebarPanel } from './components/SidebarPanel';
import { AppModals } from './components/AppModals';
import { ProgressBar } from './components/ProgressBar';
import { FileInputs } from './components/FileInputs';
import { SidebarContainer } from './components/SidebarContainer';
import { MainContent } from './components/MainContent';
import { StatusBar } from './components/StatusBar';
import { updatePaneInTree, findPaneRecursive, FileData } from './hooks/useFileManagement';
import { ProcessedCache } from './types';
import { hasNativeDialogs } from './bridge_client';
import { removeFromSet, basename } from './utils';

// 导入自定义 Hooks
import {
  useBridge,
  useUIState,
  useWorkspaceConfig,
  useRemotePathPicker,
  setBridgedCount,
  FileLoadedInfo,
  useAppModals
} from './hooks';
import { useFileManagement } from './hooks/useFileManagement';
import { useLayerManagement } from './hooks/useLayerManagement';
import { useBookmarkLogic } from './hooks/useBookmarkLogic';
import { toggleBookmark as apiToggleBookmark, getBookmarks as apiGetBookmarks, clearBookmarks as apiClearBookmarks, getLinesByIndices, physicalToVisualIndex, syncAll, getNextSearchMatch, getSearchMatchIndex, getNearestSearchRank, getSearchRankForIndex } from './bridge_client';
import { useSettings, SettingsProvider } from './hooks/useSettings';
import { ShortcutProvider, useShortcutContext } from './shortcuts';
import { useResponsive } from './hooks/useResponsive';
import { useFileWatch } from './hooks/useFileWatch';
import { usePaneManagement, MAX_PANES } from './hooks/usePaneManagement';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSystemMetrics } from './hooks/useSystemMetrics';
import './styles/resizable-panels.css';


const AppContent: React.FC = () => {
  const { settings, resolvedTheme } = useSettings();

  const systemMetrics = useSystemMetrics(settings.debugMode, 1000);

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
  
  const activePane = activePaneId ? findPaneRecursive(panes, activePaneId) : null;
  const searchQuery = activePane?.searchQuery || '';
  const searchConfig = activePane?.searchConfig || { regex: false, caseSensitive: false };
  const currentMatchRank = activePane?.currentMatchRank ?? -1;
  const searchMatchCount = activePane?.searchMatchCount ?? 0;
  
  const setSearchQuery = React.useCallback((query: string) => {
    if (activePaneId) {
      setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ ...p, searchQuery: query })));
    }
  }, [activePaneId, setPanes]);
  
  const setSearchConfig = React.useCallback((config: { regex: boolean; caseSensitive: boolean }) => {
    if (activePaneId) {
      setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ ...p, searchConfig: config })));
    }
  }, [activePaneId, setPanes]);
  
  const setCurrentMatchRank = React.useCallback((rank: number) => {
    if (activePaneId) {
      setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ ...p, currentMatchRank: rank })));
    }
  }, [activePaneId, setPanes]);

  const currentMatchNumber = currentMatchRank >= 0 ? currentMatchRank + 1 : 0;

  const clearSearch = React.useCallback(() => {
    setSearchQuery('');
    setCurrentMatchRank(-1);
  }, [setSearchQuery, setCurrentMatchRank]);
  const [canvasSelectedText, setCanvasSelectedText] = useState('');
  
  const modals = useAppModals();
  const {
    isCommandPaletteVisible,
    setIsCommandPaletteVisible,
    isSettingsVisible,
    setIsSettingsVisible,
    isShortcutsVisible,
    setIsShortcutsVisible,
    isExportDialogOpen,
    setIsExportDialogOpen,
    isStorageSettingsOpen,
    setIsStorageSettingsOpen,
    isWorkerConfigOpen,
    setIsWorkerConfigOpen,
    isPluginManagerOpen,
    setIsPluginManagerOpen,
    notification,
    showNotification
  } = modals;

  // Apply search settings from useSettings
  useEffect(() => {
    if (settings.searchRegexDefault !== searchConfig.regex || 
        settings.searchCaseSensitiveDefault !== searchConfig.caseSensitive) {
      setSearchConfig({
        regex: settings.searchRegexDefault,
        caseSensitive: settings.searchCaseSensitiveDefault
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.searchRegexDefault, settings.searchCaseSensitiveDefault]);

  // ===== UI 状态控制 (UI State) =====
  // 处理各种面板显隐、滚动定位、进度条、工作区根目录等。
  const [isSearching, setIsSearching] = React.useState(false);
  
  const uiState = useUIState({
    undo,
    redo,
    setSearchQuery,
    searchQuery,
    canvasSelectedText,
    onToggleSidebar: () => {
      setTimeout(() => {
        const currentWidth = sidebarWidth;
        setSidebarWidth(currentWidth > 0 ? 0 : 288);
      }, 0);
    },
    onOpenFile: () => { handleOpen(); },
    onOpenFolder: () => { handleNativeFolderSelect(); },
    onShowSearchHistory: () => {
      if (activePaneId) {
        setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ ...p, findVisible: true })));
      }
    },
    onToggleFind: (visible: boolean) => {
      if (activePaneId) {
        setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ 
          ...p, 
          findVisible: visible,
          goToLineVisible: visible ? false : p.goToLineVisible
        })));
      }
    },
    onToggleGoToLine: (visible: boolean) => {
      if (activePaneId) {
        setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ 
          ...p, 
          goToLineVisible: visible,
          findVisible: visible ? false : p.findVisible
        })));
      }
    },
    isFindVisible: activePaneId ? (findPaneRecursive(panes, activePaneId)?.findVisible ?? false) : false,
    isGoToLineVisible: activePaneId ? (findPaneRecursive(panes, activePaneId)?.goToLineVisible ?? false) : false
  });

  const {
    activeView,
    setActiveView,
    sidebarWidth,
    setSidebarWidth,
    scrollToIndex,
    setScrollToIndex,
    isProcessing,
    setIsProcessing,
    loadingProgress,
    setLoadingProgress,
    operationStatus,
    setOperationStatus,
    workspaceRoot,
    setWorkspaceRoot
  } = uiState;

  const handleJumpToLine = useCallback((index: number, totalLines: number) => {
    if (totalLines === 0 || !activeFileId) return;
    const boundedIndex = Math.max(0, Math.min(index, totalLines - 1));
    setScrollToIndex(boundedIndex);
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, highlightedIndex: boundedIndex } : f
    ));
    setTimeout(() => setScrollToIndex(null), 150);
  }, [activeFileId, setScrollToIndex, setFiles]);

  const handleLineClick = useCallback((index: number) => {
    if (!activeFileId) return;
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, highlightedIndex: index } : f
    ));
  }, [activeFileId, setFiles]);

  const activeHighlightedIndex = activeFile?.highlightedIndex ?? null;

  const lineCount = activeFile?.lineCount ?? 0;
  useEffect(() => {
    if (!searchQuery || !activeFileId || searchMatchCount === 0) return;
    
    const currentHighlighted = activeHighlightedIndex;
    if (currentHighlighted === null || currentHighlighted < 0) return;
    
    const timer = setTimeout(async () => {
      const { getSearchRankForIndex, getNearestSearchRank, getSearchMatchIndex } = await import('./bridge_client');
      
      const currentRank = await getSearchRankForIndex(activeFileId, currentHighlighted);
      
      if (currentRank >= 0) {
        setCurrentMatchRank(currentRank);
      } else {
        const nearestRank = await getNearestSearchRank(activeFileId, currentHighlighted, 'next');
        if (nearestRank >= 0) {
          const nearestIndex = await getSearchMatchIndex(activeFileId, nearestRank);
          if (nearestIndex >= 0) {
            setCurrentMatchRank(nearestRank);
            handleJumpToLine(nearestIndex, lineCount);
          }
        }
      }
    }, 100);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMatchCount, searchQuery, activeFileId]);

  // ===== 文件监视 (File Watch) =====
  const {
    isWatching,
    startWatching,
    stopWatching,
    hasNewContent,
    clearNewContent
  } = useFileWatch(
    undefined,
    (_newLineCount, totalLines) => {
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

  const bookmarks = activeFile?.bookmarks || {};
  const [bookmarkPreviews, setBookmarkPreviews] = React.useState<Record<number, string>>({});
  
  const fetchBookmarkPreviews = React.useCallback(async () => {
    if (!activeFileId || Object.keys(bookmarks).length === 0) {
      setBookmarkPreviews({});
      return;
    }
    const indices = Object.keys(bookmarks).map(Number).slice(0, 50);
    const lines = await getLinesByIndices(activeFileId, indices);
    const newPreviews: Record<number, string> = {};
    if (Array.isArray(lines)) {
      lines.forEach(l => {
        if (l && typeof l.index === 'number' && typeof l.text === 'string') {
          newPreviews[l.index] = l.text.length > 60 ? l.text.slice(0, 60) + '...' : l.text;
        }
      });
    }
    setBookmarkPreviews(newPreviews);
  }, [activeFileId, bookmarks]);
  
  React.useEffect(() => {
    fetchBookmarkPreviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]);
  
  const handleToggleBookmark = React.useCallback(async (lineIndex: number) => {
    if (!activeFileId) return;
    try {
      const result = await apiToggleBookmark(activeFileId, lineIndex);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, bookmarks: result } : f));
    } catch (e) {
      console.error('[App] toggleBookmark error:', e);
    }
  }, [activeFileId, setFiles]);
  
  const handleUpdateBookmarkComment = React.useCallback(async (lineIndex: number, comment: string) => {
    if (!activeFileId) return;
    try {
      const result = await apiToggleBookmark(activeFileId, lineIndex);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, bookmarks: result } : f));
    } catch (e) {
      console.error('[App] updateBookmarkComment error:', e);
    }
  }, [activeFileId, setFiles]);
  
  const handleClearBookmarks = React.useCallback(async () => {
    if (!activeFileId) return;
    if (!window.confirm('确定要清除所有书签吗？')) return;
    try {
      const result = await apiClearBookmarks(activeFileId);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, bookmarks: result } : f));
    } catch (e) {
      console.error('[App] clearBookmarks error:', e);
    }
  }, [activeFileId, setFiles]);
  
  const handleJumpToBookmark = React.useCallback(async (lineIndex: number, onJump: (visualIdx: number) => void) => {
    if (!activeFileId) return;
    const visualIdx = await physicalToVisualIndex(activeFileId, lineIndex);
    onJump(visualIdx);
  }, [activeFileId]);

  // ===== 书签快捷键导航 (Bookmark Shortcuts) =====
  useBookmarkLogic({
    activeFileId,
    highlightedIndex: activeHighlightedIndex,
    setHighlightedIndex: (idx) => {
      if (!activeFileId) return;
      setFiles(prev => prev.map(f => 
        f.id === activeFileId ? { ...f, highlightedIndex: idx } : f
      ));
    },
    setScrollToIndex
  });

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

  const findNextSearchMatchWithJump = useCallback(async (direction: 'next' | 'prev', overrideMatchCount?: number) => {
    const matchCount = overrideMatchCount ?? processedCache[activeFileId ?? '']?.searchMatchCount ?? 0;
    if (matchCount === 0) return;
    const startIndex = activeHighlightedIndex !== null ? activeHighlightedIndex : null;
    const result = await getNextSearchMatch(activeFileId!, startIndex ?? -1, direction);
    if (result.index !== -1) {
      handleJumpToLine(result.index, activeFile?.lineCount || 0);
      setCurrentMatchRank(result.rank);
    }
  }, [handleJumpToLine, activeFile?.lineCount, activeHighlightedIndex, processedCache, activeFileId, setCurrentMatchRank]);

  // 增强版：激活文件，并确保其在后端也处于同步状态
  const handleFileActivateWithLoad = useCallback((fileId: string) => {
    handleFileActivate(fileId);
  }, [handleFileActivate]);

  // ===== 桥接层集成 (Bridge Integration) =====
  // 监听来自 Python 后端的信号（文件加载完成、搜索完成、统计完成等）。
  const { activeFileIdRef, setActiveFileId: setBridgeActiveFileId } = useBridge({
    // 当后端成功解析并建立文件索引后触发
    onFileLoaded: (fileId: string, info: FileLoadedInfo) => {
      // [BUG FIX] Sanitization: Check if the file is still supposed to be open
      setFiles(prev => {
        const existingIndex = prev.findIndex(f => f.id === fileId);

        // If the file was removed from the list before this signal arrived, ignore it.
        // Special case: CLI files might not be in the list yet.
        if (existingIndex === -1 && !fileId.startsWith('cli-')) {
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
            bookmarks: {},
            isBridged: true as const,
            path: info.path || info.name,
            history: { past: [], future: [] }
          };
          setTimeout(() => setActiveFileId(fileId), 0);
          return [...prev, newFile];
        }
      });

      if (!info.partial) {
        triggerUpdate();
        setIsProcessing(false);
        setOperationStatus(null);
        markFileLoaded(fileId);
        setIndexingFileIds(prev => removeFromSet(prev, fileId));
      } else {
        triggerUpdate();
        setLoadingProgress(10);
        markFileLoaded(fileId);
        // Keep file in indexingFileIds during preview - only remove when fully loaded
        setIsProcessing(true);
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
  }, [activeFileId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps


  

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
    onToggleFind: (visible: boolean) => {
      if (activePaneId) {
        setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ ...p, findVisible: visible })));
      }
    },
    findNextSearchMatchWithJump,
    onToggleGoToLine: (visible: boolean) => {
      if (activePaneId) {
        setPanes(prev => updatePaneInTree(prev, activePaneId, (p) => ({ ...p, goToLineVisible: visible })));
      }
    },
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
        isLayerProcessing={false}
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
            files={files}
            activeFileId={activeFileId}
            activePaneId={activePaneId}
            layers={layers}
            layerStats={layerStats}
            processedCache={processedCache}
            selectedLayerId={selectedLayerId}
            presets={presets}
            saveStatus={saveStatus}
            canUndo={canUndo}
            canRedo={canRedo}
            bookmarks={bookmarks}
            bookmarkPreviews={bookmarkPreviews}
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
          />
        </SidebarContainer>

        <MainContent
          activeView={activeView}
          searchQuery={searchQuery}
          searchConfig={searchConfig}
          searchMatchCount={searchMatchCount}
          currentMatchNumber={currentMatchNumber}
          activeFile={activeFile}
          activeFileId={activeFileId}
          processedCache={processedCache}
          setSearchQuery={setSearchQuery}
          setSearchConfig={setSearchConfig}
          onNavigate={findNextSearchMatchWithJump}
          handleJumpToLine={handleJumpToLine}
          clearSearch={clearSearch}
          setProcessedCache={setProcessedCache}
          panes={panes}
          setPanes={setPanes}
          files={files}
          activePaneId={activePaneId}
          scrollToIndex={scrollToIndex}
          highlightedIndex={activeHighlightedIndex}
          setHighlightedIndex={(idx) => {
            if (!activeFileId) return;
            setFiles(prev => prev.map(f => 
              f.id === activeFileId ? { ...f, highlightedIndex: idx } : f
            ));
          }}
          indexingFileIds={indexingFileIds}
          pendingCliFiles={pendingCliFiles}
          bridgedUpdateTrigger={bridgedUpdateTrigger}
          settings={settings}
          resolvedTheme={resolvedTheme}
          hasNewContent={hasNewContent}
          setActivePaneId={setActivePaneId}
          addLayer={addLayer}
          setFiles={setFiles}
          setCanvasSelectedText={setCanvasSelectedText}
          setActiveView={setActiveView}
          clearNewContent={clearNewContent}
          setScrollToIndex={setScrollToIndex}
          removePane={removePane}
          splitPane={splitPane}
          handleOpen={handleOpen}
          onToggleFind={(paneId, visible) => {
            setPanes(prev => updatePaneInTree(prev, paneId, (p) => ({ ...p, findVisible: visible })));
          }}
          onToggleGoToLine={(paneId, visible) => {
            setPanes(prev => updatePaneInTree(prev, paneId, (p) => ({ ...p, goToLineVisible: visible })));
          }}
        />
      </div>

      <StatusBar
        lines={activeFile?.lineCount || 0}
        totalLines={activeFile?.rawCount || 0}
        size={fileSize}
        isProcessing={isProcessing || (activeFileId ? indexingFileIds.has(activeFileId) : false)}
        isLayerProcessing={false}
        operationStatus={operationStatus}
        searchMatchCount={searchMatchCount}
        currentLine={(activeHighlightedIndex !== null) ? activeHighlightedIndex + 1 : undefined}
        pendingCliFiles={pendingCliFiles}
        performanceMetrics={{
          fps: 60,
          memoryMB: systemMetrics.memoryUsedMB,
          cacheUsed: 0,
          cacheTotal: 0,
          isLowFps: false,
          isHighMemory: systemMetrics.memory > 80,
          diskReadMB: systemMetrics.diskIO.readMB,
          diskWriteMB: systemMetrics.diskIO.writeMB,
          diskReadRateMBps: systemMetrics.diskIO.readRateMBps,
          diskWriteRateMBps: systemMetrics.diskIO.writeRateMBps,
        }}
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
          showNotification('导出成功', 'success');
        }}
        isStorageSettingsOpen={isStorageSettingsOpen}
        onCloseStorageSettings={() => setIsStorageSettingsOpen(false)}
        storageDefaultPath={''}
        onStoragePathChange={() => {}}
        isWorkerConfigOpen={isWorkerConfigOpen}
        onCloseWorkerConfig={() => setIsWorkerConfigOpen(false)}
        onWorkerConfigChange={() => {}}
        isPluginManagerOpen={isPluginManagerOpen}
        onClosePluginManager={() => setIsPluginManagerOpen(false)}
      />
      
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ShortcutProvider>
        <AppContent />
      </ShortcutProvider>
    </SettingsProvider>
  );
};

export default App;
