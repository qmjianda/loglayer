import React from 'react';
import { UnifiedPanel } from './UnifiedPanel';
import { HelpPanel } from './HelpPanel';
import { LayerType } from '../types';
import { FileInfo } from './UnifiedPanel';

type ViewType = 'main' | 'help';

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

      {activeView === 'help' && <HelpPanel />}
    </>
  );
};