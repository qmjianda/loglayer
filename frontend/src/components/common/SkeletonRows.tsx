/**
 * SkeletonRows - 行级骨架占位组件（perf-deepening / loading-skeletons）
 *
 * 复用 FileLoadingSkeleton 的设计语言（animate-pulse + 主题色），
 * 用于搜索结果加载中等轻量等待场景，替代纯文字加载态。
 * 每行模拟日志行结构：左侧行号条 + 右侧内容条。
 */
import React from 'react';

export interface SkeletonRowsProps {
  /** 骨架行数，默认 5 */
  count?: number;
  /** 容器额外类名 */
  className?: string;
}

export const SkeletonRows: React.FC<SkeletonRowsProps> = ({ count = 5, className }) => (
  <div data-testid="skeleton-rows" aria-busy="true" className={className ?? 'p-2 space-y-2'}>
    {Array.from({ length: count }).map((_, i) => {
      const seed = (i * 7 + 13) % 100;
      const lineNumWidth = 16 + (seed % 14);
      const contentWidth = 20 + ((seed * 3) % 55);

      return (
        <div
          key={i}
          data-testid="skeleton-row"
          className="flex items-center gap-2 h-[18px] animate-pulse"
        >
          <div className="w-12 flex justify-end shrink-0">
            <div
              className="h-2.5 bg-theme-input opacity-60 rounded"
              style={{ width: `${lineNumWidth}px` }}
            />
          </div>
          <div className="flex-1">
            <div
              className="h-2.5 bg-theme-input opacity-60 rounded"
              style={{ width: `${contentWidth}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);
