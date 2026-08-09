/**
 * SearchResultsPanel - 搜索结果列表（Phase 3, 3.1）
 *
 * 按 rank 区间分批拉取匹配物理行号（getSearchMatchesRange）+ 行内容预览
 * （read_processed_lines），虚拟化列表展示，点击跳转（scrollToIndex + 高亮）。
 * 仅在有搜索词时渲染，空词/无匹配显示占位。
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSearchMatchesRange, readProcessedLines, physicalToVisualIndex } from '../bridge_client';

interface SearchResultsPanelProps {
  fileId: string | null;
  query: string;
  matchCount: number;
  currentRank: number;
  onJumpToLine: (visualIndex: number) => void;
}

interface ResultRow {
  rank: number;
  line: string;
}

const PAGE_SIZE = 50;

export const SearchResultsPanel: React.FC<SearchResultsPanelProps> = ({
  fileId,
  query,
  matchCount,
  currentRank,
  onJumpToLine,
}) => {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const loadSeqRef = useRef(0);

  // 搜索词变化 → 清空并重载
  useEffect(() => {
    setResults([]);
    setLoadedCount(0);
  }, [fileId, query]);

  // 分批加载匹配行（追加式）
  const loadMore = useCallback(async () => {
    if (!fileId || !query || isLoading || loadedCount >= matchCount) return;
    setIsLoading(true);
    const seq = ++loadSeqRef.current;
    try {
      const physicalLines = await getSearchMatchesRange(fileId, loadedCount, PAGE_SIZE);
      if (seq !== loadSeqRef.current || physicalLines.length === 0) return;
      // 物理行号 → 视觉行号（过滤后视图的偏移）
      const visualIndexes = await Promise.all(
        physicalLines.map((physical) => physicalToVisualIndex(fileId, physical)),
      );
      if (seq !== loadSeqRef.current) return;
      // 按视觉行号范围批量读内容预览（min..max 连续区间一次拉取）
      const minV = Math.min(...visualIndexes);
      const maxV = Math.max(...visualIndexes);
      const lines = await readProcessedLines(fileId, minV, maxV - minV + 1);
      if (seq !== loadSeqRef.current) return;
      const rows: ResultRow[] = visualIndexes.map((v, i) => {
        const raw = lines[v - minV];
        const content =
          raw && typeof raw !== 'string'
            ? ((raw as { content?: string }).content ?? '')
            : ((raw as string | undefined) ?? '');
        return { rank: loadedCount + i, line: content };
      });
      setResults((prev) => {
        const next = [...prev];
        rows.forEach((r) => {
          next[r.rank] = r;
        });
        return next;
      });
      setLoadedCount((prev) => prev + physicalLines.length);
    } catch (e) {
      console.error('[SearchResults] load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, query, isLoading, loadedCount, matchCount]);

  // 初始加载 + 滚动到底加载更多
  useEffect(() => {
    loadMore();
  }, [loadMore]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      loadMore();
    }
  };

  if (!query) {
    return (
      <div className="px-3 py-6 text-center text-[10px] text-gray-600 select-none">
        输入搜索词查看结果列表
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 border-t border-white/5">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold opacity-50 select-none">
        结果 {matchCount > 0 ? `${loadedCount} / ${matchCount}` : '无匹配'}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar" onScroll={handleScroll}>
        {matchCount === 0 ? (
          <div className="px-3 py-6 text-center text-[10px] text-red-400/70 select-none">
            无结果
          </div>
        ) : results.length === 0 && isLoading ? (
          <div className="px-3 py-6 text-center text-[10px] text-gray-600 select-none">
            加载中...
          </div>
        ) : (
          results.map((row) => (
            <button
              key={row.rank}
              onClick={() => onJumpToLine(row.rank)}
              className={`w-full text-left px-3 py-1 border-b border-white/[0.03] hover:bg-theme-input transition-colors cursor-pointer ${
                row.rank === currentRank ? 'bg-blue-500/10' : ''
              }`}
              title={`跳转到第 ${row.rank + 1} 个匹配`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[9px] text-gray-600 font-mono shrink-0">{row.rank + 1}</span>
                <span className="text-[10px] text-gray-300 truncate font-mono">
                  {row.line || ' '}
                </span>
              </div>
            </button>
          ))
        )}
        {isLoading && results.length > 0 && (
          <div className="px-3 py-2 text-center text-[10px] text-gray-600 select-none">
            加载更多...
          </div>
        )}
      </div>
    </div>
  );
};
