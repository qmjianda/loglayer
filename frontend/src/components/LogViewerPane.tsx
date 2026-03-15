import React, { useState, useCallback, useRef } from 'react';
import { LogViewer } from './LogViewer';
import { FileLoadingSkeleton, PendingFilesWall } from './LoadingOverlays';
import { EmptyState } from './EmptyState';
import { TabBar } from './TabBar';
import { LayerType } from '../types';
import { Pane, FileData } from '../hooks/useFileManagement';

interface LogViewerPaneProps {
  pane: Pane;
  paneFile: FileData | undefined;
  files: FileData[];
  isPaneActive: boolean;
  isFindVisible: boolean;
  activeView: string;
  searchQuery: string;
  searchConfig: { regex: boolean; caseSensitive: boolean };
  scrollToIndex: number | null;
  highlightedIndex: number | null;
  indexingFileIds: Set<string>;
  pendingCliFiles: number;
  bridgedUpdateTrigger: number;
  settings: any;
  resolvedTheme: any;
  hasNewContent: boolean;
  canClose: boolean;
  onTabClick: (fileId: string) => void;
  onTabClose: (paneId: string, fileId: string) => void;
  onTabsReorder?: (paneId: string, fromIndex: number, toIndex: number) => void;
  onPaneDragEnd?: (fileId: string, position: 'left' | 'right' | 'top' | 'bottom' | null, sourcePaneId: string | null) => void;
  onCloseTab?: (paneId: string, fileId: string) => void;
  onCloseOtherTabs?: (keepFileId: string) => void;
  onCloseAllTabs?: () => void;
  onSplitTabRight?: (fileId: string) => void;
  onSplitTabDown?: (fileId: string) => void;
  onLineClick: (idx: number) => void;
  onAddLayer: (type: LayerType, config?: any) => void;
  onToggleBookmark: (lineIndex: number) => void;
  onUpdateBookmarkComment: (lineIndex: number, comment: string) => void;
  onSelectedTextChange: (text: string) => void;
  onSendToAI: (text: string) => void;
  onScrollToNewContent: () => void;
  onPaneClose: () => void;
  onPaneClick: () => void;
  onOpen: () => void;
}

export const LogViewerPane: React.FC<LogViewerPaneProps> = ({
  pane,
  paneFile,
  files,
  isPaneActive,
  isFindVisible,
  activeView,
  searchQuery,
  searchConfig,
  scrollToIndex,
  highlightedIndex,
  indexingFileIds,
  pendingCliFiles,
  bridgedUpdateTrigger,
  settings,
  resolvedTheme,
  hasNewContent,
  canClose,
  onTabClick,
  onTabClose,
  onTabsReorder,
  onPaneDragEnd,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onSplitTabRight,
  onSplitTabDown,
  onLineClick,
  onAddLayer,
  onToggleBookmark,
  onUpdateBookmarkComment,
  onSelectedTextChange,
  onSendToAI,
  onScrollToNewContent,
  onPaneClose,
  onPaneClick,
  onOpen
}) => {
  const paneFileId = pane.activeFileId;
  const isLoading = paneFileId && indexingFileIds.has(paneFileId);
  const [splitPosition, setSplitPosition] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const draggedFileId = useRef<string | null>(null);
  const draggedPaneId = useRef<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    const hasFileType = e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('Files');
    
    if (!dragStartPos.current) {
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      isDragging.current = hasFileType;
      return;
    }
    
    if (!isDragging.current) {
      return;
    }
    
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    const distance = Math.abs(deltaX) + Math.abs(deltaY);
    
    if (distance < 20) {
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    let position: 'left' | 'right' | 'top' | 'bottom' | null = null;

    if (relX < width * 0.25) {
      position = 'left';
    } else if (relX > width * 0.75) {
      position = 'right';
    } else if (relY < height * 0.25) {
      position = 'top';
    } else if (relY > height * 0.75) {
      position = 'bottom';
    }

    setSplitPosition(position);
    if (position) {
      const fileId = e.dataTransfer.getData('text/plain');
      console.log(`[Drag] Split position detected: ${position} | fileId: ${fileId || 'from ref'}`);
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    isDragging.current = true;
    // Capture drag data when entering
    const fileId = e.dataTransfer.getData('text/plain');
    const srcPaneId = e.dataTransfer.getData('application/x-pane-id');
    if (fileId) draggedFileId.current = fileId;
    if (srcPaneId) draggedPaneId.current = srcPaneId;
    console.log(`[DragEnter] fileId=${fileId}, srcPaneId=${srcPaneId}, targetPane=${pane.id}`);
  }, [pane.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragStartPos.current = null;
    isDragging.current = false;
    
    let fileId = draggedFileId.current || e.dataTransfer.getData('text/plain');
    let srcPaneId = draggedPaneId.current || e.dataTransfer.getData('application/x-pane-id');
    
    console.log(`[Drop] srcPaneId=${srcPaneId}, targetPaneId=${pane.id}, splitPosition=${splitPosition}, fileId=${fileId}`);
    
    draggedFileId.current = null;
    draggedPaneId.current = null;
    
    // Allow split even within same pane - MainContent will check if source has only 1 tab
    
    if (fileId && splitPosition) {
      console.log(`[Drop] EXECUTING SPLIT: fileId=${fileId}, position=${splitPosition}, srcPane=${srcPaneId}`);
      onPaneDragEnd?.(fileId, splitPosition, srcPaneId);
    }
    setSplitPosition(null);
  }, [splitPosition, onPaneDragEnd, pane.id]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      dragStartPos.current = null;
      isDragging.current = false;
      setSplitPosition(null);
    }
  }, []);

  return (
    <div 
      className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isPaneActive ? 'ring-1 ring-blue-500/30' : ''}`} 
      style={{ height: '100%' }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      <TabBar
        openFileIds={pane.openFileIds}
        activeFileId={pane.activeFileId}
        files={files}
        paneId={pane.id}
        isPaneActive={isPaneActive}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
        onTabsReorder={onTabsReorder}
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseAllTabs={onCloseAllTabs}
        onSplitTabRight={onSplitTabRight}
        onSplitTabDown={onSplitTabDown}
        onPaneClick={onPaneClick}
      />
      <div 
        className="flex-1 flex flex-col relative min-h-0 overflow-hidden" 
        style={{ minHeight: 0 }}
      >
        {splitPosition && (
          <div className={`absolute pointer-events-none z-10 ${
            splitPosition === 'left' ? 'left-0 top-0 bottom-0 w-1/4 bg-blue-500/20 border-l-4 border-l-blue-500' :
            splitPosition === 'right' ? 'right-0 top-0 bottom-0 w-1/4 bg-blue-500/20 border-r-4 border-r-blue-500' :
            splitPosition === 'top' ? 'top-0 left-0 right-0 h-1/4 bg-blue-500/20 border-t-4 border-t-blue-500' :
            'bottom-0 left-0 right-0 h-1/4 bg-blue-500/20 border-b-4 border-b-blue-500'
          }`}>
            <div className={`absolute text-blue-400 text-xs ${
              splitPosition === 'left' ? 'right-2 top-1/2 -translate-y-1/2' :
              splitPosition === 'right' ? 'left-2 top-1/2 -translate-y-1/2' :
              splitPosition === 'top' ? 'bottom-2 left-1/2 -translate-x-1/2' :
              'top-2 left-1/2 -translate-x-1/2'
            }`}>
              {splitPosition === 'left' && '← Split Left'}
              {splitPosition === 'right' && 'Split Right →'}
              {splitPosition === 'top' && '↑ Split Top'}
              {splitPosition === 'bottom' && 'Split Bottom ↓'}
            </div>
          </div>
        )}
        {paneFileId ? (
          isLoading ? (
            <FileLoadingSkeleton fileName={paneFile?.name} />
          ) : (
            <LogViewer
              key={paneFileId}
              totalLines={paneFile?.lineCount || 0}
              fileId={pane.activeFileId}
              searchQuery={isFindVisible ? searchQuery : ''}
              searchConfig={searchConfig}
              scrollToIndex={isPaneActive ? scrollToIndex : null}
              highlightedIndex={isPaneActive ? highlightedIndex : null}
              isIndexing={isLoading}
              onLineClick={onLineClick}
              onAddLayer={onAddLayer}
              onToggleBookmark={onToggleBookmark}
              onUpdateBookmarkComment={onUpdateBookmarkComment}
              onSelectedTextChange={onSelectedTextChange}
              onSendToAI={onSendToAI}
              updateTrigger={bridgedUpdateTrigger}
              settings={settings}
              resolvedTheme={resolvedTheme}
              hasNewContent={hasNewContent}
              onScrollToNewContent={onScrollToNewContent}
            />
          )
        ) : pendingCliFiles > 0 ? (
          <PendingFilesWall count={pendingCliFiles} />
        ) : (
          <EmptyState onOpen={onOpen} />
        )}
      </div>
    </div>
  );
};
