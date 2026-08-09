/**
 * DebugOverlay - 诊断浮层（Phase 3, 3.5）
 *
 * Ctrl+Shift+D 开关。展示：
 * - 缓存命中统计（内存/SQLite/计算，来源可区分）
 * - 各文件管线阶段耗时（filter/search/total ms）
 * - per-tab 搜索状态快照（词/配置/rank/匹配数）
 * 仅挂载时渲染，关闭不残留 DOM，不影响主界面。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchStore, selectActiveTab } from '../store/searchStore';

interface CacheStats {
  pipeline: { memory_hit: number; sqlite_hit: number; computed: number };
  search: { memory_hit: number; sqlite_hit: number; computed: number };
}

interface SessionInfo {
  path: string;
  timing: { filter_ms?: number; search_ms?: number; total_ms?: number };
  matches: number;
  visible: number | null;
}

interface Diagnostics {
  cache_stats: CacheStats;
  sessions: Record<string, SessionInfo>;
}

export const DebugOverlay: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const activeTab = useSearchStore(selectActiveTab);
  const activePanelId = useSearchStore((s) => s.activePanelId);

  // 拉取诊断数据
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await fetch('/api/diagnostics');
      if (resp.ok) {
        const data = await resp.json();
        setDiag(data);
      }
    } catch (e) {
      // 忽略（诊断数据不可用时保持现状）
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      refresh();
      const timer = setInterval(refresh, 3000); // 3s 轮询
      return () => clearInterval(timer);
    }
  }, [visible, refresh]);

  // 记录最近事件（本地收集：打开/刷新）
  useEffect(() => {
    if (visible) {
      setEvents((prev) =>
        [`[${new Date().toLocaleTimeString()}] overlay opened`, ...prev].slice(0, 20),
      );
    }
  }, [visible]);

  if (!visible) return null;

  const stats = diag?.cache_stats;
  const pipeline = stats?.pipeline;
  const search = stats?.search;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dark-2 border border-white/10 rounded-lg shadow-2xl w-[720px] max-h-[80vh] overflow-y-auto custom-scrollbar p-4 select-text"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-wider font-bold opacity-70">
            Debug Overlay (Ctrl+Shift+D)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="text-[10px] px-2 py-0.5 bg-theme-input rounded hover:bg-[#555] cursor-pointer"
            >
              {refreshing ? '刷新中...' : '刷新'}
            </button>
            <button
              onClick={onClose}
              className="text-[10px] px-2 py-0.5 bg-theme-input rounded hover:bg-red-500/30 cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 缓存命中统计 */}
        <div className="mb-4">
          <div className="text-[10px] opacity-50 uppercase font-bold mb-2">缓存命中统计</div>
          {stats ? (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1">缓存</th>
                  <th className="text-right">内存命中</th>
                  <th className="text-right">SQLite命中</th>
                  <th className="text-right">实际计算</th>
                  <th className="text-right">命中率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-0.5">pipeline</td>
                  <td className="text-right">{pipeline?.memory_hit ?? 0}</td>
                  <td className="text-right">{pipeline?.sqlite_hit ?? 0}</td>
                  <td className="text-right">{pipeline?.computed ?? 0}</td>
                  <td className="text-right text-green-400">
                    {(() => {
                      const hit = (pipeline?.memory_hit ?? 0) + (pipeline?.sqlite_hit ?? 0);
                      const total = hit + (pipeline?.computed ?? 0);
                      return total > 0 ? `${Math.round((hit / total) * 100)}%` : '-';
                    })()}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5">search</td>
                  <td className="text-right">{search?.memory_hit ?? 0}</td>
                  <td className="text-right">{search?.sqlite_hit ?? 0}</td>
                  <td className="text-right">{search?.computed ?? 0}</td>
                  <td className="text-right text-green-400">
                    {(() => {
                      const hit = (search?.memory_hit ?? 0) + (search?.sqlite_hit ?? 0);
                      const total = hit + (search?.computed ?? 0);
                      return total > 0 ? `${Math.round((hit / total) * 100)}%` : '-';
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-[10px] text-gray-600">加载中...</div>
          )}
        </div>

        {/* 管线阶段耗时 */}
        <div className="mb-4">
          <div className="text-[10px] opacity-50 uppercase font-bold mb-2">管线阶段耗时 (ms)</div>
          {diag && Object.entries(diag.sessions).length > 0 ? (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1">文件</th>
                  <th className="text-right">过滤</th>
                  <th className="text-right">搜索</th>
                  <th className="text-right">总计</th>
                  <th className="text-right">匹配</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(diag.sessions).map(([fid, s]) => (
                  <tr key={fid}>
                    <td className="py-0.5 truncate max-w-[200px]" title={s.path}>
                      {s.path.split('/').pop()}
                    </td>
                    <td className="text-right">{s.timing?.filter_ms ?? '-'}</td>
                    <td className="text-right">{s.timing?.search_ms ?? '-'}</td>
                    <td className="text-right">{s.timing?.total_ms ?? '-'}</td>
                    <td className="text-right">{s.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-[10px] text-gray-600">暂无管线数据</div>
          )}
        </div>

        {/* per-tab 搜索状态快照 */}
        <div className="mb-4">
          <div className="text-[10px] opacity-50 uppercase font-bold mb-2">
            当前面板搜索状态 (per-tab)
          </div>
          <div className="text-[10px] font-mono space-y-0.5">
            <div>
              activePanelId: <span className="text-blue-400">{activePanelId ?? '(none)'}</span>
            </div>
            <div>
              query:{' '}
              <span className="text-yellow-400">
                {activeTab?.query ? `"${activeTab.query}"` : '(空)'}
              </span>
            </div>
            <div>
              config: <span className="text-green-400">{JSON.stringify(activeTab?.config)}</span>
            </div>
            <div>
              rank: <span className="text-purple-400">{activeTab?.currentMatchRank}</span>
            </div>
            <div>
              findVisible: <span className="text-cyan-400">{String(activeTab?.isFindVisible)}</span>
            </div>
          </div>
        </div>

        {/* 事件流 */}
        <div>
          <div className="text-[10px] opacity-50 uppercase font-bold mb-2">事件流</div>
          <div className="text-[10px] font-mono text-gray-400 max-h-32 overflow-y-auto custom-scrollbar space-y-0.5">
            {events.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
