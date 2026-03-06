import React from 'react';

interface EmptyStateProps {
  onOpen: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onOpen }) => {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center text-gray-600 bg-theme-base cursor-pointer hover:bg-theme-surface"
      onClick={onOpen}
    >
      <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm font-medium">将日志文件拖拽至此处打开</p>
      <p className="text-xs mt-2 opacity-60">或点击浏览并打开文件/文件夹</p>
      <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-300/30 max-w-xs">
        <p className="text-xs font-semibold text-blue-400 mb-2">分屏: Ctrl+\ 或 Ctrl+Shift+\</p>
        <p className="text-xs text-muted">关闭: Ctrl+W (保留至少1个分屏)</p>
      </div>
    </div>
  );
};
