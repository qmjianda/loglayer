import React from 'react';
import { UnifiedPanel } from './UnifiedPanel';
import { FileData } from '../hooks/useFileManagement';
import { LayerType, ProcessedCache } from '../types';

type ViewType = 'main' | 'help';

interface SidebarPanelProps {
  activeView: ViewType;
  workspaceRoot: { path: string; name: string } | null;
  files: FileData[];
  activeFileId: string | null;
  activePaneId: string | null;
  layers: any[];
  layerStats: Record<string, { count: number; distribution: number[] }>;
  processedCache: Record<string, ProcessedCache>;
  selectedLayerId: string | null;
  presets: any[];
  saveStatus: any;
  canUndo: boolean;
  canRedo: boolean;
  bookmarks: unknown;
  bookmarkPreviews: unknown;
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
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  activeView,
  workspaceRoot,
  files,
  activeFileId,
  activePaneId,
  layers,
  layerStats,
  processedCache,
  selectedLayerId,
  presets,
  saveStatus,
  canUndo,
  canRedo,
  bookmarks,
  bookmarkPreviews,
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
  onJumpToBookmark
}) => {
  return (
    <>
      {activeView === 'main' && (
        <UnifiedPanel
          workspaceRoot={workspaceRoot}
          onOpenFileByPath={onOpenFileByPath}
          files={files}
          activeFileId={activeFileId}
          activePaneId={activePaneId}
          onOpen={onOpen}
          onFileActivate={onFileActivate}
          onFileRemove={onFileRemove}
          layers={layers}
          layerStats={layerStats}
          processedCache={processedCache}
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
    </>
  );
};