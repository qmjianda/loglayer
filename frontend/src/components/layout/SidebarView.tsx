/**
 * SidebarView - 左侧边栏与视图切换区（refactor-app-orchestration）。
 *
 * 承载：Sidebar 按钮列 + 侧栏面板容器（资源管理器/搜索视图）+ 宽度拖拽 handle。
 * 从 App.tsx 提取，通过 props 契约接收数据与回调。
 */
import React from 'react';
import { Sidebar } from '../Sidebar';
import { UnifiedPanel } from '../UnifiedPanel';
import { SearchPanel } from '../SearchPanel';
import { SearchResultsPanel } from '../SearchResultsPanel';
import { PluginWidgetSlot } from '../PluginWidgetSlot';
import type { FileData } from '../../hooks/useFileManagement';
import type { SearchConfig, LogLayer } from '../../types';

export interface SidebarViewProps {
  activeView: 'main' | 'search' | 'help';
  setActiveView: (v: 'main' | 'search' | 'help') => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  isMobile: boolean;
  workspaceRoot: { path: string; name: string } | null;
  files: FileData[];
  activeFileId: string | null;
  activeFile: FileData | undefined;
  searchConfig: SearchConfig;
  setSearchConfig: (c: SearchConfig) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchMatchCount: number;
  currentMatchNumber: number;
  isWatching: boolean;
  hasNewContent: boolean;
  onToggleWatch: () => void;
  onOpenSettings: () => void;
  onOpenFileByPath: (path: string, name: string) => void;
  onOpen: () => void;
  onFileActivate: (fileId: string) => void;
  onFileRemove: (fileId: string) => void;
  onFileRemoveFromHistory: (fileId: string) => void;
  onFindNavigate: (direction: 'next' | 'prev') => void;
  onJumpToLine: (idx: number) => void;
  onJumpToRank: (rank: number) => Promise<number>;
}

export const SidebarView: React.FC<SidebarViewProps> = ({
  activeView,
  setActiveView,
  sidebarWidth,
  setSidebarWidth,
  isMobile,
  workspaceRoot,
  files,
  activeFileId,
  activeFile,
  searchConfig,
  setSearchConfig,
  searchQuery,
  setSearchQuery,
  searchMatchCount,
  currentMatchNumber,
  isWatching,
  hasNewContent,
  onToggleWatch,
  onOpenSettings,
  onOpenFileByPath,
  onOpen,
  onFileActivate,
  onFileRemove,
  onFileRemoveFromHistory,
  onFindNavigate,
  onJumpToLine,
  onJumpToRank,
}) => {
  return (
    <>
      {/* 左侧侧边栏按钮（Explorer, Search, Help） */}
      <Sidebar
        activeView={activeView}
        onSetActiveView={setActiveView}
        onOpenSettings={onOpenSettings}
        isWatching={isWatching}
        onToggleWatch={onToggleWatch}
        hasNewContent={hasNewContent}
      />

      {/* 侧边栏面板容器 */}
      <div
        className={`bg-secondary border-r border-subtle flex flex-col shrink-0 shadow-lg relative group/sidebar 
          ${isMobile ? 'absolute inset-y-0 left-10 z-40' : ''}`}
        style={{
          width: isMobile ? (sidebarWidth > 0 ? sidebarWidth : 280) : sidebarWidth,
          display: isMobile && sidebarWidth === 0 ? 'none' : 'flex',
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
              const newWidth = Math.max(
                200,
                Math.min(600, startWidth + (moveEvent.clientX - startX)),
              );
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

        {/* 资源管理器视图：文件树 + 历史文件（纯导航） */}
        {activeView === 'main' && (
          <UnifiedPanel
            workspaceRoot={workspaceRoot}
            onOpenFileByPath={onOpenFileByPath}
            files={files}
            activeFileId={activeFileId}
            onOpen={onOpen}
            onFileActivate={onFileActivate}
            onFileRemove={onFileRemove}
            onFileRemoveFromHistory={onFileRemoveFromHistory}
          />
        )}

        {/* 全局搜索视图 */}
        {activeView === 'search' && (
          <>
            <SearchPanel
              onSearch={setSearchQuery}
              config={searchConfig}
              setConfig={setSearchConfig}
              matchCount={searchMatchCount}
              onNavigate={onFindNavigate}
              currentIndex={currentMatchNumber}
              externalQuery={searchQuery}
            />
            <SearchResultsPanel
              fileId={activeFileId}
              query={searchQuery}
              matchCount={searchMatchCount}
              currentRank={currentMatchNumber - 1}
              onJumpToLine={async (rank) => {
                const physical = await onJumpToRank(rank);
                if (physical !== -1) {
                  onJumpToLine(physical);
                }
              }}
            />
          </>
        )}

        {/* 插件固定槽位：sidebar（无插件时渲染 null） */}
        <PluginWidgetSlot slot="sidebar" className="mt-auto p-2 space-y-2 border-t border-subtle" />
      </div>
    </>
  );
};
