import React, { useMemo, useState } from 'react';

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

type LevelKey = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

const levelConfig: Record<LevelKey, { color: string; bgColor: string; borderColor: string; icon: React.ReactNode }> = {
  ERROR: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/50',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  WARN: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/50',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
      </svg>
    )
  },
  INFO: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  DEBUG: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )
  },
  TRACE: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/50',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  }
};

const QUICK_FILTERS = [
  { name: '全部', levels: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'FATAL'], color: 'bg-theme-elevated' },
  { name: '仅错误', levels: ['ERROR', 'FATAL'], color: 'bg-red-500/20 text-red-400' },
  { name: '警告+', levels: ['WARN', 'ERROR', 'FATAL'], color: 'bg-yellow-500/20 text-yellow-400' },
  { name: '生产', levels: ['WARN', 'ERROR', 'FATAL'], color: 'bg-orange-500/20 text-orange-400' },
  { name: '开发', levels: ['INFO', 'DEBUG', 'TRACE'], color: 'bg-blue-500/20 text-blue-400' },
];

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, total, onQuickFilter }) => {
  const levels: LevelKey[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'].filter(level => stats[level] > 0) as LevelKey[];
  const [activeFilter, setActiveFilter] = useState<string>('全部');
  
  const maxCount = useMemo(() => Math.max(...Object.values(stats), 1), [stats]);

  const handleFilterClick = (filter: typeof QUICK_FILTERS[0]) => {
    setActiveFilter(filter.name);
    onQuickFilter?.(filter.levels);
  };

  const handleLevelClick = (level: string) => {
    onQuickFilter?.([level]);
  };

  const errorCount = (stats.ERROR || 0) + (stats.FATAL || 0);
  const errorRate = total > 0 ? ((errorCount / total) * 100).toFixed(1) : '0';

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-theme-muted">
        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">暂无日志数据</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-theme-primary">日志统计</h3>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          className="p-3 rounded-xl bg-theme-elevated/50 border border-theme-subtle cursor-pointer hover:border-theme-default transition-colors"
          onClick={() => onQuickFilter?.(['ERROR', 'FATAL'])}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-theme-muted">错误</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary font-mono">{errorCount.toLocaleString()}</div>
          <div className="text-xs text-red-400">{errorRate}%</div>
        </div>
        <div className="p-3 rounded-xl bg-theme-elevated/50 border border-theme-subtle">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-theme-muted">总计</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary font-mono">{total.toLocaleString()}</div>
          <div className="text-xs text-theme-muted">行</div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      {onQuickFilter && (
        <div className="flex flex-wrap gap-1.5 pb-3 border-b border-theme-subtle">
          {QUICK_FILTERS.map(filter => (
            <button
              key={filter.name}
              onClick={() => handleFilterClick(filter)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                activeFilter === filter.name
                  ? filter.color || 'bg-blue-600 text-white'
                  : 'bg-theme-elevated text-theme-secondary hover:bg-theme-default hover:text-theme-primary'
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
      )}

      {/* Level Distribution with Donut-style Visualization */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 mb-2">
          <span className="text-xs text-theme-muted">日志等级分布</span>
        </div>
        {levels.map(level => {
          const config = levelConfig[level];
          const count = stats[level];
          const percentage = ((count / total) * 100).toFixed(1);
          const width = (count / maxCount) * 100;
          
          return (
            <div 
              key={level} 
              className="group"
            >
              <div 
                className="flex items-center justify-between p-2 rounded-lg bg-theme-elevated/30 hover:bg-theme-elevated cursor-pointer transition-colors"
                onClick={() => handleLevelClick(level)}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${config.bgColor}`}>
                    {config.icon}
                  </div>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {level}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-theme-primary">{count.toLocaleString()}</div>
                  <div className="text-xs text-theme-muted">{percentage}%</div>
                </div>
              </div>
              <div className="h-1.5 mt-1 bg-theme-surface rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.bgColor.replace('/20', '')} rounded-full transition-all duration-500`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini Bar Chart */}
      <div className="pt-3 border-t border-theme-subtle">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-theme-muted">分布预览</span>
        </div>
        <div className="flex h-8 rounded-lg overflow-hidden">
          {levels.map(level => {
            const config = levelConfig[level];
            const width = (stats[level] / total) * 100;
            return (
              <div
                key={level}
                className={`${config.bgColor.replace('/20', '')} transition-all duration-300 cursor-pointer hover:opacity-80`}
                style={{ width: `${width}%` }}
                onClick={() => handleLevelClick(level)}
                title={`${level}: ${stats[level]} (${((stats[level] / total) * 100).toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {levels.map(level => (
            <div key={level} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${levelConfig[level].bgColor.replace('/20', '')}`} />
              <span className="text-[10px] text-theme-muted">{level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
