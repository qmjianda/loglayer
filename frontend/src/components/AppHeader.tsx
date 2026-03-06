import React from 'react';

interface AppHeaderProps {
  fileName: string;
  isProcessing: boolean;
  fileCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  fileName,
  isProcessing,
  fileCount
}) => {
  return (
    <div className="h-9 bg-tertiary flex items-center px-4 border-b border-subtle shrink-0 justify-between">
      <div className="flex items-center space-x-4">
        <span className="text-blue-400 font-black tracking-tighter flex items-center cursor-default">
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5-10-5zM2 17l10 5 10-5-10-5-10 5zM2 12l10 5 10-5-10-5-10 5z" />
          </svg>
          LogLayer
        </span>
      </div>
      <div className="text-[10px] text-gray-500 font-mono truncate max-w-xs">
        {fileName || (isProcessing ? '正在解析文件...' : '就绪')}
        {fileCount > 1 && ` (+${fileCount - 1})`}
      </div>
    </div>
  );
};
