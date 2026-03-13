import React from 'react';
import { LogViewer } from './LogViewer';
import { FileLoadingSkeleton, PendingFilesWall } from './LoadingOverlays';
import { EmptyState } from './EmptyState';
import { PaneHeader } from './common/PaneHeader';
import { LayerType } from '../types';

interface LogViewerPaneProps {
  pane: { id: string; fileId: string | null };
  paneFile: any;
  isPaneActive: boolean;
  isFindVisible: boolean;
  activeView: string;
  searchQuery: string;
  searchConfig: { regex: boolean; caseSensitive: boolean };
  scrollToIndex: number | null;
  highlightedIndex: number | null;
  loadingFileIds: Set<string>;
  indexingFileIds: Set<string>;
  pendingCliFiles: number;
  bridgedUpdateTrigger: number;
  settings: any;
  resolvedTheme: any;
  hasNewContent: boolean;
  canClose: boolean;
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
  isPaneActive,
  isFindVisible,
  activeView,
  searchQuery,
  searchConfig,
  scrollToIndex,
  highlightedIndex,
  loadingFileIds,
  indexingFileIds,
  pendingCliFiles,
  bridgedUpdateTrigger,
  settings,
  resolvedTheme,
  hasNewContent,
  canClose,
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
  const paneFileId = pane.fileId;
  const isLoading = paneFileId && (loadingFileIds.has(paneFileId) || indexingFileIds.has(paneFileId));

  return (
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${isPaneActive ? 'ring-1 ring-blue-500/30' : ''}`} style={{ height: '100%' }}>
      <PaneHeader
        file={paneFile}
        paneId={pane.id}
        isActive={isPaneActive}
        onClose={canClose ? onPaneClose : undefined}
        onClick={onPaneClick}
      />
      <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden" style={{ minHeight: 0 }}>
        {paneFileId ? (
          isLoading ? (
            <FileLoadingSkeleton fileName={paneFile?.name} />
          ) : (
            <LogViewer
              key={paneFileId}
              totalLines={paneFile?.lineCount || 0}
              fileId={pane.fileId}
              searchQuery={isFindVisible ? searchQuery : ''}
              searchConfig={searchConfig}
              scrollToIndex={isPaneActive ? scrollToIndex : null}
              highlightedIndex={isPaneActive ? highlightedIndex : null}
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
