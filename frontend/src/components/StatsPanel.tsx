import React, { useMemo } from 'react';

export interface LogLevelStats {
  ERROR: number;
  WARN: number;
  INFO: number;
  DEBUG: number;
  TRACE: number;
  [key: string]: number;
}

interface StatsPanelProps {
  stats: LogLevelStats;
  total: number;
  onQuickFilter?: (levels: string[]) => void;
}

const levelColors: Record<string, string> = {
  ERROR: 'bg-red-500',
  WARN: 'bg-yellow-500',
  INFO: 'bg-green-500',
  DEBUG: 'bg-blue-500',
  TRACE: 'bg-gray-500'
};

const levelBorderColors: Record<string, string> = {
  ERROR: 'border-red-500 hover:border-red-400 hover:bg-red-500/10',
  WARN: 'border-yellow-500 hover:border-yellow-400 hover:bg-yellow-500/10',
  INFO: 'border-green-500 hover:border-green-400 hover:bg-green-500/10',
  DEBUG: 'border-blue-500 hover:border-blue-400 hover:bg-blue-500/10',
  TRACE: 'border-gray-500 hover:border-gray-400 hover:bg-gray-500/10'
};

// Quick filter presets
const QUICK_FILTERS = [
  { name: '全部', levels: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'FATAL'] },
  { name: '仅错误', levels: ['ERROR', 'FATAL'] },
  { name: '警告+', levels: ['WARN', 'ERROR', 'FATAL'] },
  { name: '生产', levels: ['WARN', 'ERROR', 'FATAL'] },
  { name: '开发', levels: ['INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE', 'FATAL'] },
];

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, total, onQuickFilter }) => {
  const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].filter(level => stats[level] > 0);
  
  const maxCount = useMemo(() => Math.max(...Object.values(stats), 1), [stats]);
  
  if (total === 0) {
    return (
      <div className="p-4 text-theme-muted text-sm">
        暂无日志数据
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-theme-primary">日志统计</h3>
        {onQuickFilter && (
          <span className="text-xs text-theme-muted">点击等级快速过滤</span>
        )}
      </div>
      
      {/* Quick Filter Presets */}
      {onQuickFilter && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-theme-subtle">
          {QUICK_FILTERS.map(preset => (
            <button
              key={preset.name}
              onClick={() => onQuickFilter(preset.levels)}
              className="px-2 py-1 text-xs rounded border border-theme-subtle text-theme-secondary 
                         hover:border-theme-primary hover:text-theme-primary transition-colors"
              title={`过滤：${preset.levels.join(', ')}`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Level Distribution */}
      <div className="space-y-3">
        {levels.map(level => {
          const count = stats[level];
          const percentage = ((count / total) * 100).toFixed(1);
          const width = (count / maxCount) * 100;
          
          return (
            <div 
              key={level} 
              className="space-y-1"
              onClick={() => onQuickFilter?.([level])}
            >
              <div className="flex justify-between text-xs">
                <span 
                  className={`text-theme-secondary cursor-pointer px-1.5 py-0.5 rounded border ${levelBorderColors[level]}`}
                  title="点击仅显示此等级"
                >
                  {level}
                </span>
                <span className="text-theme-muted">
                  {count.toLocaleString()} ({percentage}%)
                </span>
              </div>
              <div className="h-2 bg-theme-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full ${levelColors[level]} rounded-full transition-all duration-300`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="pt-3 border-t border-theme-subtle">
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">总计</span>
          <span className="text-theme-secondary">{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
