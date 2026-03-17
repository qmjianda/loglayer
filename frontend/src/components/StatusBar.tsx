import React from 'react';
import { usePluginWidgets } from '../hooks/usePluginWidgets';
import { useSettings } from '../hooks/useSettings';
import { PerformanceIndicator } from './PerformanceIndicator';
import { PerformanceMetrics } from '../hooks/useVirtualScroll';

interface StatusBarProps {
  lines: number;
  totalLines: number;
  size: number;
  isProcessing?: boolean;
  isLayerProcessing?: boolean;
  operationStatus?: { op: string, progress: number, error?: string } | null;
  searchMatchCount?: number;
  currentLine?: number;
  pendingCliFiles?: number;
  performanceMetrics?: PerformanceMetrics;
  isWatching?: boolean;
  hasNewContent?: boolean;
  paneCount?: number;
  maxPanes?: number;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  lines, totalLines, size, isProcessing, isLayerProcessing, 
  operationStatus, searchMatchCount, currentLine, pendingCliFiles,
  performanceMetrics,
  isWatching, hasNewContent,
  paneCount, maxPanes,
  onOpenSettings, onOpenShortcuts 
}) => {
  const { widgets, widgetData } = usePluginWidgets('statusbar');
  const { settings } = useSettings();
  const showPerformance = settings.debugMode && performanceMetrics;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusMessage = () => {
    if (operationStatus) {
      if (operationStatus.error) return `错误: ${operationStatus.error}`;
      const prefix = operationStatus.op === 'indexing' ? '正在建立索引' :
        operationStatus.op === 'filtering' ? '正在过滤日志' :
          operationStatus.op === 'searching' ? '正在搜索' : '正在处理';
      return `${prefix}... ${operationStatus.progress > 0 ? `(${Math.round(operationStatus.progress)}%)` : ''}`;
    }
    if (isLayerProcessing && isProcessing) return '正在并行处理数据...';
    if (isProcessing) return '正在加载流式日志...';
    if (isLayerProcessing) return '正在刷新处理管道...';
    if (pendingCliFiles && pendingCliFiles > 0) return `正在打开文件... (${pendingCliFiles} 个待处理)`;
    return '就绪';
  };

  return (
    <div className={`h-6 bg-theme-active text-white flex items-center justify-between px-3 text-[11px] font-medium shrink-0 transition-colors duration-300`}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1.5 hover:bg-white/10 px-1 rounded transition-colors">
          {(isProcessing || isLayerProcessing) ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="font-bold tracking-tight">{getStatusMessage()}</span>
        </div>

        {/* File Watch Indicator */}
        {isWatching && (
          <div className="flex items-center space-x-1.5 text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs">
              {hasNewContent ? '新内容可用' : '监视中'}
            </span>
          </div>
        )}

        {/* Plugin Dynamic Widgets */}
        {widgets.map(w => {
          const data = widgetData[w.type];
          if (!data) return null;
          return (
            <div
              key={w.type}
              className="flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-white/10 cursor-help transition-colors border-x border-white/5"
              title={data.tooltip || w.display_name}
              style={{ color: data.color }}
            >
              {data.icon && <span className="mr-1">{/* Icon render support can be added here */}</span>}
              <span className="font-medium whitespace-nowrap">{data.text || w.display_name}</span>
            </div>
          );
        })}

        <div className="hover:bg-white/10 px-1 cursor-pointer transition-colors opacity-80">UTF-8</div>
        
        {/* 分屏数量指示器 */}
        {paneCount !== undefined && maxPanes && (
          <div className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition-colors ${
            paneCount >= maxPanes ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30' : 'hover:bg-white/10'
          }`} title={paneCount >= maxPanes ? '已达到最大分屏数量' : '当前分屏数量'}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeWidth="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
              {paneCount > 1 && <path strokeWidth="2" d="M12 4v16m-6-6h12" />}
            </svg>
            <span className="text-xs">{paneCount}/{maxPanes}</span>
          </div>
        )}
        
        {showPerformance && performanceMetrics && (
          <PerformanceIndicator metrics={performanceMetrics} visible={true} />
        )}
      </div>
      <div className="flex items-center space-x-6">
        {searchMatchCount !== undefined && searchMatchCount > 0 && (
          <div className="bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-200 border border-yellow-500/30 flex items-center space-x-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            <span>{searchMatchCount.toLocaleString()} matches</span>
          </div>
        )}
        <div className="opacity-90 font-mono">
          {lines === totalLines ? (
            <span>{(Number(totalLines) || 0).toLocaleString()} Lines</span>
          ) : (
            <>
              <span>{(Number(lines) || 0).toLocaleString()}</span>
              <span className="mx-1 opacity-50">/</span>
              <span className="opacity-70">{(Number(totalLines) || 0).toLocaleString()}</span>
            </>
          )}
        </div>
        <div className="opacity-90">Size: {formatSize(size || 0)}</div>
        <div className="hover:bg-white/10 px-1 cursor-pointer transition-colors hidden sm:block">Tab Size: 2</div>
        <div className="hover:bg-white/10 px-1 cursor-pointer transition-colors font-mono whitespace-nowrap">
          Ln {currentLine || 1}, Col 1
        </div>
        
        {/* 功能按钮 */}
        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={onOpenShortcuts}
            className="hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors text-[10px] opacity-70 hover:opacity-100"
            title="快捷键"
          >
            ⌨
          </button>
          <button
            onClick={onOpenSettings}
            className="hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors text-[10px] opacity-70 hover:opacity-100"
            title="设置"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  );
};
