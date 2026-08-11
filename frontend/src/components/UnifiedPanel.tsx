import React, { useState } from 'react';
import { FileTree } from './FileTree';
import { FileData } from '../hooks/useFileManagement';

interface UnifiedPanelProps {
  // Workspace
  workspaceRoot: { path: string; name: string } | null;
  onOpenFileByPath: (path: string, name: string) => void;

  // 文件相关
  files: FileData[];
  activeFileId: string | null;
  onOpen: () => void;
  onFileActivate: (fileId: string) => void;
  onFileRemove: (fileId: string) => void;
  onFileRemoveFromHistory: (fileId: string) => void;
}

// 简化后的 Section ID（左侧回归纯导航）
type SectionId = 'explorer' | 'history';

export const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
  workspaceRoot,
  onOpenFileByPath,
  files,
  activeFileId,
  onOpen,
  onFileActivate,
  onFileRemove,
  onFileRemoveFromHistory,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>({
    explorer: false,
    history: false,
  });

  // 历史文件（wasOpen=false）
  const historyFiles = files.filter((f) => f.wasOpen === false);

  const toggleSection = (section: SectionId) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 1. 资源管理器 (Pure Tree) */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div
          className="flex items-center px-3 py-2 bg-header border-b border-theme-subtle cursor-pointer hover:bg-theme-elevated select-none shrink-0"
          onClick={() => toggleSection('explorer')}
        >
          <svg
            className={`w-3 h-3 mr-2 transition-transform ${collapsedSections.explorer ? '' : 'rotate-90'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] uppercase font-black tracking-wider opacity-60 whitespace-nowrap">
            资源管理器
          </span>
          {workspaceRoot && (
            <span className="ml-2 text-[10px] text-blue-400 font-medium truncate shrink whitespace-nowrap">
              {workspaceRoot.name}
            </span>
          )}
        </div>

        {!collapsedSections.explorer && (
          <div className="flex-1 flex flex-col overflow-hidden bg-theme-surface">
            {/* 文件/文件夹选择操作 - 始终显示，以便于随时切换文件夹 */}
            <div className="flex gap-1 p-2 border-b border-theme-subtle bg-theme-surface shrink-0">
              <button
                onClick={onOpen}
                className="flex-1 flex items-center justify-center gap-2 text-[10px] py-1.5 bg-theme-accent hover:bg-blue-600 text-white rounded transition-colors shadow-sm font-bold"
                title="打开文件或项目文件夹"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                浏览并打开 (Open)
              </button>
            </div>

            {workspaceRoot ? (
              <FileTree
                rootPath={workspaceRoot.path}
                rootName={workspaceRoot.name}
                onFileClick={onOpenFileByPath}
                activeFilePath={files.find((f) => f.id === activeFileId)?.path}
                openedFiles={files}
              />
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                <svg
                  className="w-12 h-12 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeWidth="1"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <p className="text-[11px] text-theme-muted leading-relaxed">
                  未选择项目文件夹。
                  <br />
                  通过上方“浏览并打开”按钮选择目录或文件。
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. 历史文件（wasOpen=false，仅列表，点击重新打开） */}
      <div className="shrink-0 border-t border-theme-subtle">
        <div
          className="flex items-center px-3 py-2 bg-header cursor-pointer hover:bg-theme-elevated select-none shrink-0"
          onClick={() => toggleSection('history')}
        >
          <svg
            className={`w-3 h-3 mr-2 transition-transform ${collapsedSections.history ? '' : 'rotate-90'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] uppercase font-black tracking-wider opacity-60">
            历史文件
          </span>
          <span className="ml-auto text-[9px] text-theme-muted">{historyFiles.length}</span>
        </div>

        {!collapsedSections.history && historyFiles.length > 0 && (
          <div className="overflow-y-auto custom-scrollbar bg-theme-surface max-h-48">
            {historyFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center py-1 px-2 cursor-pointer select-none group transition-colors hover:bg-theme-hover text-theme-muted"
                onClick={() => onFileActivate(file.id)}
                title="点击重新打开"
              >
                <svg
                  className="w-3 h-3 mr-2 shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] truncate flex-1">{file.name}</span>
                <button
                  className="w-4 h-4 ml-1 shrink-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-theme-muted"
                  title="从历史中删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemoveFromHistory(file.id);
                  }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
