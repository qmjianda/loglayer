import { useMemo } from 'react';
import { LogLevelStats } from '../components/StatsPanel';

export interface UseLogStatsReturn {
  stats: LogLevelStats;
  total: number;
}

const LEVEL_PATTERNS: Record<string, RegExp[]> = {
  ERROR: [/\bERROR\b/i, /\bERR\b/i, /\bFATAL\b/i, /\bCRITICAL\b/i],
  WARN: [/\bWARN(?:ING)?\b/i],
  INFO: [/\bINFO\b/i],
  DEBUG: [/\bDEBUG\b/i],
  TRACE: [/\bTRACE\b/i],
};

function countLevel(line: string): string | null {
  for (const [level, patterns] of Object.entries(LEVEL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return level;
      }
    }
  }
  return null;
}

export function useLogStats(lines: string[]): UseLogStatsReturn {
  return useMemo(() => {
    const stats: LogLevelStats = {
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      DEBUG: 0,
      TRACE: 0
    };
    
    for (const line of lines) {
      const level = countLevel(line);
      if (level && level in stats) {
        stats[level]++;
      }
    }
    
    return {
      stats,
      total: lines.length
    };
  }, [lines]);
}
