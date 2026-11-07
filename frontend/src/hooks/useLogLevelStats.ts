import { useCallback, useEffect, useRef, useState } from 'react';
import { getLogLevelStats } from '../bridge_client';
import type { LogLevelStats } from '../types';

/** 空统计（引用稳定，避免切文件时无意义重渲染） */
export const EMPTY_LOG_LEVEL_STATS: LogLevelStats = Object.freeze({
  ERROR: 0,
  WARN: 0,
  INFO: 0,
  DEBUG: 0,
  TRACE: 0,
  FATAL: 0,
});

export interface UseLogLevelStatsReturn {
  stats: LogLevelStats;
  loading: boolean;
  refresh: (fileId: string | null) => Promise<void>;
}

/**
 * useLogLevelStats - 文件级级别统计（log-level-stats）
 *
 * 竞态约束：只有「当前激活文件 + 最新请求」的响应可以写入状态。
 * 切文件时立即清空旧统计并使在途请求失效。
 */
export function useLogLevelStats(activeFileId: string | null): UseLogLevelStatsReturn {
  const [stats, setStats] = useState<LogLevelStats>(EMPTY_LOG_LEVEL_STATS);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);
  const activeRef = useRef(activeFileId);
  activeRef.current = activeFileId;

  useEffect(() => {
    // 切换激活文件：旧响应一律视为过期
    seqRef.current += 1;
    setStats(EMPTY_LOG_LEVEL_STATS);
    setLoading(false);
  }, [activeFileId]);

  const refresh = useCallback(async (fileId: string | null) => {
    if (!fileId) return;

    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const raw = await getLogLevelStats(fileId);
      if (seqRef.current !== seq || activeRef.current !== fileId) return;
      setStats({
        ERROR: raw.ERROR || 0,
        WARN: raw.WARN || 0,
        INFO: raw.INFO || 0,
        DEBUG: raw.DEBUG || 0,
        TRACE: raw.TRACE || 0,
        FATAL: raw.FATAL || 0,
      });
    } catch (e) {
      console.error('[LogLevelStats] Failed to fetch:', e);
    } finally {
      if (seqRef.current === seq && activeRef.current === fileId) {
        setLoading(false);
      }
    }
  }, []);

  return { stats, loading, refresh };
}
