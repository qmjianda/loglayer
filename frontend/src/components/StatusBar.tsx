import React from 'react';
import { usePluginWidgets, type WidgetRenderInput } from '../hooks/usePluginWidgets';
import { renderWidgetWithIsolation } from '../rendering/registry';
import { useSettings } from '../hooks/useSettings';
import { PerformanceIndicator } from './PerformanceIndicator';
import { PerformanceMetrics } from '../hooks/useVirtualScroll';
import {
  FILE_LOADING_MESSAGE,
  formatOperationStatus,
  getOperationStatusMessage,
} from '../constants/statusMessages';

interface StatusBarProps {
  lines: number;
  totalLines: number;
  size: number;
  isProcessing?: boolean;
  isLayerProcessing?: boolean;
  isSearching?: boolean;
  operationStatus?: { op: string; progress: number; error?: string } | null;
  searchMatchCount?: number;
  currentLine?: number;
  pendingCliFiles?: number;
  performanceMetrics?: PerformanceMetrics;
  isWatching?: boolean;
  hasNewContent?: boolean;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  lines,
  totalLines,
  size,
  isProcessing,
  isLayerProcessing,
  isSearching,
  operationStatus,
  searchMatchCount,
  currentLine,
  pendingCliFiles,
  performanceMetrics,
  isWatching,
  hasNewContent,
  onOpenSettings,
  onOpenShortcuts,
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
      return formatOperationStatus(operationStatus);
    }
    if (isLayerProcessing && isProcessing) return `${getOperationStatusMessage('other')}...`;
    if (isProcessing) return `${getOperationStatusMessage('indexing')}...`;
    if (isLayerProcessing) return `${getOperationStatusMessage('other')}...`;
    if (isSearching) return `${getOperationStatusMessage('searching')}...`;
    if (pendingCliFiles && pendingCliFiles > 0)
      return `${FILE_LOADING_MESSAGE}... (${pendingCliFiles} 个待处理)`;
    return '就绪';
  };

  return (
    <div className="h-6 bg-theme-active text-white flex items-center justify-between px-3 text-[11px] font-medium leading-none shrink-0 transition-colors duration-300 overflow-hidden">
      <div className="flex items-center space-x-4 min-w-0 flex-1 overflow-hidden whitespace-nowrap">
        <div className="flex items-center space-x-1.5 hover:bg-white/10 px-1 rounded transition-colors shrink-0">
          {isProcessing ||
          isLayerProcessing ||
          isSearching ||
          Boolean(operationStatus && !operationStatus.error) ? (
            <svg
              className="w-3.5 h-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path
                d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="3"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="font-bold tracking-tight whitespace-nowrap">{getStatusMessage()}</span>
        </div>

        {/* File Watch Indicator */}
        {isWatching && (
          <div className="flex items-center space-x-1.5 text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs">{hasNewContent ? '新内容可用' : '监视中'}</span>
          </div>
        )}

        {/* Plugin Dynamic Widgets */}
        <div className="hidden sm:flex items-center space-x-1">
          {widgets.map((w) => {
            const data = widgetData[w.type];
            if (!data) return null;

            const input: WidgetRenderInput = { data, config: w.config, widget: w };
            const rendered = renderWidgetWithIsolation(w.renderer_id, input);

            const text = rendered?.text ?? data.text ?? w.display_name;
            const color = rendered?.color ?? data.color;
            const tooltip = rendered?.tooltip ?? data.tooltip ?? w.display_name;
            const className = rendered?.className;

            return (
              <div
                key={w.type}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-white/10 cursor-help transition-colors border-x border-white/5${className ? ` ${className}` : ''}`}
                title={tooltip}
                style={color ? { color } : undefined}
              >
                {data.icon && (
                  <span className="mr-1">{/* Icon render support can be added here */}</span>
                )}
                <span className="font-medium whitespace-nowrap">{text}</span>
              </div>
            );
          })}
        </div>

        <div className="hover:bg-white/10 px-1 cursor-pointer transition-colors opacity-80 shrink-0 hidden sm:block">
          UTF-8
        </div>

        {showPerformance && performanceMetrics && (
          <div className="hidden sm:block shrink-0">
            <PerformanceIndicator metrics={performanceMetrics} visible={true} />
          </div>
        )}
      </div>
      <div className="hidden sm:flex items-center space-x-3 shrink-0 whitespace-nowrap">
        {searchMatchCount !== undefined && searchMatchCount > 0 && (
          <div className="hidden sm:flex bg-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-200 border border-yellow-500/30 items-center space-x-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
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
        <div className="opacity-90 hidden sm:block">Size: {formatSize(size || 0)}</div>
        <div className="hover:bg-white/10 px-1 cursor-pointer transition-colors hidden sm:block">
          Tab Size: 2
        </div>
        <div className="hover:bg-white/10 px-1 cursor-pointer transition-colors font-mono whitespace-nowrap hidden sm:block">
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
