/**
 * InspectorDock - 右侧操作台（refactor-app-orchestration）。
 *
 * 承载当前文件的检视面板：摘要/图层/预设/书签/统计 + 宽度拖拽 handle。
 * 从 App.tsx 提取，通过 props 契约接收数据与回调。
 */
import React from 'react';
import { InspectorPanel } from '../InspectorPanel';
import { PluginWidgetSlot } from '../PluginWidgetSlot';
import type { FileData } from '../../hooks/useFileManagement';
import type { LogLayer, LayerType, LayerPreset, LogLevelStats } from '../../types';

export interface InspectorDockProps {
  activeFile: FileData | undefined;
  layers: LogLayer[];
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  layerStats: Record<string, { count: number; distribution: number[] }>;
  inspectorWidth: number;
  setInspectorWidth: (w: number) => void;
  isMobile: boolean;
  bookmarks: Record<number, string>;
  bookmarkPreviews: Record<number, string>;
  presets: LayerPreset[];
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'idle' | 'saved';
  logLevelStats: LogLevelStats;
  statsLoading?: boolean;
  onLayerRemove: (id: string) => void;
  onLayerToggle: (id: string) => void;
  onLayerUpdate: (id: string, update: Partial<LogLayer>) => void;
  onLayerDrop: (
    draggedId: string,
    targetId: string | null,
    position: 'inside' | 'before' | 'after',
  ) => void;
  onAddLayer: (type: LayerType) => void;
  onJumpToLine: (idx: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPresetApply: (preset: LayerPreset) => void;
  onPresetDelete: (id: string) => void;
  onSavePresetWithName: (name: string) => void;
  onToggleBookmark: (lineIndex: number) => void;
  onClearBookmarks: () => void;
  onJumpToBookmark: (idx: number) => void;
}

export const InspectorDock: React.FC<InspectorDockProps> = ({
  activeFile,
  layers,
  selectedLayerId,
  setSelectedLayerId,
  layerStats,
  inspectorWidth,
  setInspectorWidth,
  isMobile,
  bookmarks,
  bookmarkPreviews,
  presets,
  canUndo,
  canRedo,
  saveStatus,
  logLevelStats,
  statsLoading,
  onLayerRemove,
  onLayerToggle,
  onLayerUpdate,
  onLayerDrop,
  onAddLayer,
  onJumpToLine,
  onUndo,
  onRedo,
  onPresetApply,
  onPresetDelete,
  onSavePresetWithName,
  onToggleBookmark,
  onClearBookmarks,
  onJumpToBookmark,
}) => {
  return (
    <div
      className={`bg-secondary border-l border-subtle flex flex-col shrink-0 shadow-lg relative group/inspector
        ${isMobile ? 'absolute inset-y-0 right-0 z-40' : ''}`}
      style={{
        width: isMobile ? (inspectorWidth > 0 ? inspectorWidth : 280) : inspectorWidth,
        display: isMobile && inspectorWidth === 0 ? 'none' : 'flex',
      }}
    >
      {/* 拖拽调整宽度的 Handle（左边缘，200-480 clamp） */}
      <div
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors opacity-0 group-hover/inspector:opacity-100"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = inspectorWidth;
          const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(
              200,
              Math.min(480, startWidth + (startX - moveEvent.clientX)),
            );
            setInspectorWidth(newWidth);
          };
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />

      <InspectorPanel
        activeFile={activeFile}
        layers={layers}
        selectedLayerId={selectedLayerId}
        setSelectedLayerId={setSelectedLayerId}
        layerStats={layerStats}
        onLayerRemove={onLayerRemove}
        onLayerToggle={onLayerToggle}
        onLayerUpdate={onLayerUpdate}
        onLayerDrop={onLayerDrop}
        onAddLayer={onAddLayer}
        onJumpToLine={onJumpToLine}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        presets={presets}
        onPresetApply={onPresetApply}
        onPresetDelete={onPresetDelete}
        onSavePresetWithName={onSavePresetWithName}
        saveStatus={saveStatus}
        bookmarks={bookmarks}
        bookmarkPreviews={bookmarkPreviews}
        onToggleBookmark={onToggleBookmark}
        onClearBookmarks={onClearBookmarks}
        onJumpToBookmark={onJumpToBookmark}
        logLevelStats={logLevelStats}
        statsLoading={statsLoading}
      />

      {/* 插件固定槽位：inspector（无插件时渲染 null） */}
      <PluginWidgetSlot slot="inspector" className="p-2 space-y-2 border-t border-subtle" />
    </div>
  );
};
