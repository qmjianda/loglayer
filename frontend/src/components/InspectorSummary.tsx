import React, { useState } from 'react';
import { FileData } from '../hooks/useFileManagement';
import { LogLevelStats } from '../types';

interface InspectorSummaryProps {
  activeFile: FileData;
  logLevelStats: LogLevelStats;
}

const LEVELS: { key: string; label: string; color: string }[] = [
  { key: 'ERROR', label: 'ERROR', color: 'bg-red-500' },
  { key: 'WARN', label: 'WARN', color: 'bg-yellow-500' },
  { key: 'INFO', label: 'INFO', color: 'bg-green-500' },
  { key: 'DEBUG', label: 'DEBUG', color: 'bg-blue-500' },
  { key: 'TRACE', label: 'TRACE', color: 'bg-gray-500' },
];

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const InspectorSummary: React.FC<InspectorSummaryProps> = ({
  activeFile,
  logLevelStats,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPath = async () => {
    if (!activeFile.path) return;
    try {
      await navigator.clipboard.writeText(activeFile.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('[InspectorSummary] Copy path error:', e);
    }
  };

  const total = LEVELS.reduce((sum, l) => sum + (logLevelStats[l.key] || 0), 0);

  return (
    <div className="shrink-0 px-3 py-2.5 bg-theme-elevated border-b border-theme-subtle space-y-1.5 select-none">
      {/* 文件名 */}
      <div
        className="text-[12px] font-semibold text-theme-primary truncate"
        title={activeFile.name}
      >
        {activeFile.name}
      </div>

      {/* 完整路径 + 复制按钮 */}
      {activeFile.path && (
        <div className="flex items-center gap-1 group">
          <span
            className="text-[10px] text-theme-muted font-mono truncate flex-1"
            title={activeFile.path}
          >
            {activeFile.path}
          </span>
          <button
            onClick={handleCopyPath}
            className={`shrink-0 p-1 rounded transition-colors ${copied ? 'text-green-400' : 'text-theme-muted opacity-0 group-hover:opacity-100 hover:text-theme-primary'}`}
            title="复制完整路径"
          >
            {copied ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* 大小 / 总行数 */}
      <div className="flex items-center gap-3 text-[10px] text-theme-muted">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H6a2 2 0 00-2 2z"
            />
          </svg>
          {formatSize(activeFile.size || 0)}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
          {(activeFile.lineCount || 0).toLocaleString()} 行
        </span>
      </div>

      {/* 级别分布堆叠条 */}
      <div className="space-y-1">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-black/20">
          {LEVELS.map((l) => {
            const count = logLevelStats[l.key] || 0;
            if (count === 0) return null;
            return (
              <div
                key={l.key}
                className={`${l.color} h-full`}
                style={{ width: `${(count / Math.max(total, 1)) * 100}%` }}
                title={`${l.label}: ${count.toLocaleString()}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          {LEVELS.map((l) => {
            const count = logLevelStats[l.key] || 0;
            return (
              <span key={l.key} className="flex items-center gap-1 text-[9px] text-theme-muted">
                <span className={`w-1.5 h-1.5 rounded-full ${l.color}`} />
                {l.label} {count.toLocaleString()}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
