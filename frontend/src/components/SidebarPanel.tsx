import React from 'react';
import { UnifiedPanel } from './UnifiedPanel';
import { SearchPanel } from './SearchPanel';
import { AIChatPanel } from './AIChatPanel';
import { StatsPanel } from './StatsPanel';
import { PatternAnalysisPanel } from './PatternAnalysisPanel';
import { SavedViewsPanel } from './SavedViewsPanel';
import { LayerType } from '../types';
import { FileInfo } from './UnifiedPanel';

type ViewType = 'main' | 'search' | 'ai' | 'stats' | 'help' | 'views';

interface SidebarPanelProps {
  activeView: ViewType;
  workspaceRoot: { path: string; name: string } | null;
  fileInfoList: FileInfo[];
  activeFileId: string | null;
  layers: any[];
  layerStats: Record<string, { count: number; distribution: number[] }>;
  selectedLayerId: string | null;
  presets: any[];
  saveStatus: any;
  canUndo: boolean;
  canRedo: boolean;
  bookmarks: unknown;
  bookmarkPreviews: unknown;
  logLevelStats: { ERROR: number; WARN: number; INFO: number; DEBUG: number; TRACE: number; FATAL?: number };
  searchConfig: { regex: boolean; caseSensitive: boolean };
  searchMatchCount: number;
  currentMatchNumber: number;
  fileId: string | null;
  onOpen: () => void;
  onOpenFileByPath: (path: string, name: string) => void;
  onFileActivate: (fileId: string) => void;
  onFileRemove: (fileId: string) => void;
  onSelectLayer: (id: string | null) => void;
  onLayerDrop: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onLayerRemove: (id: string) => void;
  onLayerToggle: (id: string) => void;
  onLayerUpdate: (id: string, update: unknown) => void;
  onAddLayer: (type: LayerType, config?: unknown) => void;
  onJumpToLine: (idx: number) => void;
  onPresetApply: (p: unknown) => void;
  onPresetDelete: (id: string) => void;
  onPresetSave: any;
  onUndo: () => void;
  onRedo: () => void;
  onToggleBookmark: (lineIndex: number) => void;
  onClearBookmarks: () => void;
  onJumpToBookmark: (idx: number) => void;
  onSearch: (query: string) => void;
  onSearchConfigChange: (config: unknown) => void;
  onNavigateSearch: (direction: 'next' | 'prev') => void;
  onAiPanelClose: () => void;
  onAiPanelInitialContent: string;
  onApplyAiSuggestion: (type: string, value: string) => void;
  onQuickFilter: (levels: string[]) => void;
  onApplyPatternSuggestion: (suggestion: unknown) => void;
  showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  updateLayers: (updater: (layers: unknown[]) => unknown) => void;
  activeFile: { lineCount?: number } | null;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  activeView,
  workspaceRoot,
  fileInfoList,
  activeFileId,
  layers,
  layerStats,
  selectedLayerId,
  presets,
  saveStatus,
  canUndo,
  canRedo,
  bookmarks,
  bookmarkPreviews,
  logLevelStats,
  searchConfig,
  searchMatchCount,
  currentMatchNumber,
  fileId,
  onOpen,
  onOpenFileByPath,
  onFileActivate,
  onFileRemove,
  onSelectLayer,
  onLayerDrop,
  onLayerRemove,
  onLayerToggle,
  onLayerUpdate,
  onAddLayer,
  onJumpToLine,
  onPresetApply,
  onPresetDelete,
  onPresetSave,
  onUndo,
  onRedo,
  onToggleBookmark,
  onClearBookmarks,
  onJumpToBookmark,
  onSearch,
  onSearchConfigChange,
  onNavigateSearch,
  onAiPanelClose,
  onAiPanelInitialContent,
  onApplyAiSuggestion,
  onQuickFilter,
  onApplyPatternSuggestion,
  showNotification,
  updateLayers,
  activeFile
}) => {
  return (
    <>
      {activeView === 'main' && (
        <UnifiedPanel
          workspaceRoot={workspaceRoot}
          onOpenFileByPath={onOpenFileByPath}
          files={fileInfoList}
          activeFileId={activeFileId}
          onOpen={onOpen}
          onFileActivate={onFileActivate}
          onFileRemove={onFileRemove}
          layers={layers}
          layerStats={layerStats}
          selectedLayerId={selectedLayerId}
          fileId={activeFileId}
          onSelectLayer={onSelectLayer}
          onLayerDrop={onLayerDrop}
          onLayerRemove={onLayerRemove}
          onLayerToggle={onLayerToggle}
          onLayerUpdate={onLayerUpdate}
          onAddLayer={onAddLayer}
          onJumpToLine={onJumpToLine}
          presets={presets}
          onPresetApply={onPresetApply}
          onPresetDelete={onPresetDelete}
          onPresetSave={onPresetSave}
          saveStatus={saveStatus}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          bookmarkRefreshTrigger={0}
          bookmarks={bookmarks as Record<number, string>}
          bookmarkPreviews={bookmarkPreviews as Record<number, string>}
          onToggleBookmark={onToggleBookmark}
          onClearBookmarks={onClearBookmarks}
          onJumpToBookmark={onJumpToBookmark}
        />
      )}

      {activeView === 'search' && (
        <SearchPanel
          onSearch={onSearch}
          config={searchConfig}
          setConfig={onSearchConfigChange}
          matchCount={searchMatchCount}
          onNavigate={onNavigateSearch}
          currentIndex={currentMatchNumber}
        />
      )}

      {activeView === 'ai' && (
        <AIChatPanel 
          initialContent={onAiPanelInitialContent}
          onClose={onAiPanelClose}
          onApplySuggestion={onApplyAiSuggestion}
        />
      )}

      {activeView === 'stats' && (
        <div className="flex-1 overflow-auto">
          <StatsPanel 
            stats={logLevelStats}
            total={activeFile?.lineCount || 0}
            onQuickFilter={onQuickFilter}
          />
          <PatternAnalysisPanel 
            fileId={fileId}
            onApplySuggestion={onApplyPatternSuggestion}
          />
        </div>
      )}

      {activeView === 'views' && (
        <SavedViewsPanel
          isOpen={true}
          onClose={() => {}}
          currentLayers={layers}
          onLoadView={(viewName, viewLayers) => {
            onPresetApply({ layers: viewLayers });
            showNotification?.(`已加载视图: ${viewName}`, 'success');
          }}
        />
      )}
    </>
  );
};
