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
}

const levelColors: Record<string, string> = {
  ERROR: 'bg-red-500',
  WARN: 'bg-yellow-500',
  INFO: 'bg-green-500',
  DEBUG: 'bg-blue-500',
  TRACE: 'bg-gray-500'
};

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, total }) => {
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
      <h3 className="text-sm font-medium text-theme-primary">日志统计</h3>
      
      <div className="space-y-3">
        {levels.map(level => {
          const count = stats[level];
          const percentage = ((count / total) * 100).toFixed(1);
          const width = (count / maxCount) * 100;
          
          return (
            <div key={level} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-theme-secondary">{level}</span>
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
