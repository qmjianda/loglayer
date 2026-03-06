import React from 'react';
import { HelpPanel } from './HelpPanel';
import { FloatingWidgets } from './FloatingWidgets';
import { LogViewerPane } from './LogViewerPane';
import { EmptyState } from './EmptyState';
import { Allotment } from 'allotment';

interface FileData {
  id: string;
  name: string;
  lineCount?: number;
}

interface MainContentProps {
  activeView: string;
  isFindVisible: boolean;
  isGoToLineVisible: boolean;
  searchQuery: string;
  searchConfig: { regex: boolean; caseSensitive: boolean };
  searchMatchCount: number;
  currentMatchNumber: number;
  searchMode: any;
  activeFile: { lineCount?: number } | null;
  activeFileId: string | null;
  processedCache: any;
  setSearchQuery: (query: string) => void;
  setSearchConfig: (config: any) => void;
  findNextSearchMatchWithJump: (direction: 'next' | 'prev') => void;
  setSearchMode: any;
  handleJumpToLine: (line: number, total: number) => void;
  setIsFindVisible: (visible: boolean) => void;
  setIsGoToLineVisible: (visible: boolean) => void;
  clearSearch: () => void;
  setProcessedCache: any;
  panes: Array<{ id: string; fileId: string | null }>;
  files: FileData[];
  activePaneId: string;
  scrollToIndex: number | null;
  highlightedIndex: number | null;
  loadingFileIds: Set<string>;
  indexingFileIds: Set<string>;
  pendingCliFiles: number;
  bridgedUpdateTrigger: number;
  settings: any;
  resolvedTheme: any;
  hasNewContent: boolean;
  setActivePaneId: (id: string) => void;
  addLayer: (type: any, config?: any) => void;
  handleToggleBookmark: (lineIndex: number) => void;
  handleUpdateBookmarkComment: (lineIndex: number, comment: string) => void;
  setCanvasSelectedText: (text: string) => void;
  setAiPanelInitialContent: (text: string) => void;
  setActiveView: (view: any) => void;
  clearNewContent: () => void;
  setScrollToIndex: any;
  removePane: (paneId: string) => void;
  handleOpen: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  activeView,
  isFindVisible,
  isGoToLineVisible,
  searchQuery,
  searchConfig,
  searchMatchCount,
  currentMatchNumber,
  searchMode,
  activeFile,
  activeFileId,
  processedCache,
  setSearchQuery,
  setSearchConfig,
  findNextSearchMatchWithJump,
  setSearchMode,
  handleJumpToLine,
  setIsFindVisible,
  setIsGoToLineVisible,
  clearSearch,
  setProcessedCache,
  panes,
  files,
  activePaneId,
  scrollToIndex,
  highlightedIndex,
  loadingFileIds,
  indexingFileIds,
  pendingCliFiles,
  bridgedUpdateTrigger,
  settings,
  resolvedTheme,
  hasNewContent,
  setActivePaneId,
  addLayer,
  handleToggleBookmark,
  handleUpdateBookmarkComment,
  setCanvasSelectedText,
  setAiPanelInitialContent,
  setActiveView,
  clearNewContent,
  setScrollToIndex,
  removePane,
  handleOpen
}) => {
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-theme-base relative select-text overflow-hidden">
      {activeView === 'help' ? (
        <HelpPanel />
      ) : (
        <>
          <FloatingWidgets
            isFindVisible={isFindVisible}
            isGoToLineVisible={isGoToLineVisible}
            searchQuery={searchQuery}
            searchConfig={searchConfig}
            searchMatchCount={searchMatchCount}
            currentMatchNumber={currentMatchNumber}
            searchMode={searchMode}
            totalLines={activeFile?.lineCount || 0}
            activeFileId={activeFileId}
            processedCache={processedCache}
            onQueryChange={setSearchQuery}
            onConfigChange={setSearchConfig}
            onNavigate={findNextSearchMatchWithJump}
            onSearchModeChange={setSearchMode}
            onGoToLine={(lineNum) => {
              handleJumpToLine(lineNum - 1, activeFile?.lineCount || 0);
              setIsGoToLineVisible(false);
            }}
            onCloseFind={() => setIsFindVisible(false)}
            onCloseGoToLine={() => setIsGoToLineVisible(false)}
            clearSearch={clearSearch}
            setProcessedCache={setProcessedCache}
          />

          <Allotment className="flex-1">
            {panes.map((pane) => {
              const paneFileId = pane.fileId;
              const paneFile = files.find(f => f.id === paneFileId);
              const isPaneActive = activePaneId === pane.id;

              return (
                <Allotment.Pane key={pane.id} minSize={200}>
                  <LogViewerPane
                    pane={pane}
                    paneFile={paneFile}
                    isPaneActive={isPaneActive}
                    isFindVisible={isFindVisible}
                    activeView={activeView}
                    searchQuery={searchQuery}
                    searchConfig={searchConfig}
                    scrollToIndex={isPaneActive ? scrollToIndex : null}
                    highlightedIndex={isPaneActive ? highlightedIndex : null}
                    loadingFileIds={loadingFileIds}
                    indexingFileIds={indexingFileIds}
                    pendingCliFiles={pendingCliFiles}
                    bridgedUpdateTrigger={bridgedUpdateTrigger}
                    settings={settings}
                    resolvedTheme={resolvedTheme}
                    hasNewContent={hasNewContent}
                    canClose={panes.length > 1}
                    onLineClick={(idx) => {
                      if (!isPaneActive) setActivePaneId(pane.id);
                      // setHighlightedIndex(idx);
                    }}
                    onAddLayer={addLayer}
                    onToggleBookmark={handleToggleBookmark}
                    onUpdateBookmarkComment={handleUpdateBookmarkComment}
                    onSelectedTextChange={setCanvasSelectedText}
                    onSendToAI={(text) => { setAiPanelInitialContent(text); setActiveView('ai'); }}
                    onScrollToNewContent={() => {
                      clearNewContent();
                      if (activeFile?.lineCount) {
                        setScrollToIndex(activeFile.lineCount - 1);
                      }
                    }}
                    onPaneClose={() => removePane(pane.id)}
                    onPaneClick={() => setActivePaneId(pane.id)}
                    onOpen={handleOpen}
                  />
                </Allotment.Pane>
              );
            })}
          </Allotment>
        </>
      )}
    </div>
  );
};