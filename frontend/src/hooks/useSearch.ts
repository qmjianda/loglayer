/**
 * useSearch - Search state and operations hook
 *
 * Manages search query, config, match navigation, and sync with backend.
 * Includes local state management and F3 keyboard shortcuts.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { syncAll } from '../bridge_client';
import { LogLayer } from '../types';
import type { SearchConfig, SearchMode } from '../types';
import { useSearchStore } from '../store/searchStore';
import { timingLog } from '../utils/timing';

export type { SearchConfig, SearchMode };

export interface UseSearchProps {
  activeFileId: string | null;
  /** 当前激活面板 id（dockview panelId）；切 tab 时按此读写 per-tab 搜索状态 */
  activePanelId: string | null;
  layers: LogLayer[];
  layersFunctionalHash: string;
  lineCount: number;
  searchMatchCount: number;
  setProcessedCache: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export interface UseSearchReturn {
  // State
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchConfig: SearchConfig;
  setSearchConfig: React.Dispatch<React.SetStateAction<SearchConfig>>;

  // Match state
  currentMatchRank: number;
  setCurrentMatchRank: (rank: number) => void;
  currentMatchIndex: number;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;

  // Computed
  searchMatchCount: number;
  currentMatchNumber: number;

  // Search history
  searchHistory: string[];
  clearSearchHistory: () => void;
  removeFromSearchHistory: (query: string) => void;

  // Operations
  findNextSearchMatch: (direction: 'next' | 'prev', fromIndex?: number | null) => Promise<number>;
  /** 跳到指定 rank 的匹配（返回物理行号，-1 失败） */
  jumpToRank: (rank: number) => Promise<number>;
  clearSearch: () => void;
}

// Search history management
const SEARCH_HISTORY_KEY = 'loglayer_search_history';
const MAX_SEARCH_HISTORY = 20;

function loadSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (stored) {
      const history = JSON.parse(stored);
      return Array.isArray(history) ? history.slice(0, MAX_SEARCH_HISTORY) : [];
    }
  } catch (e) {
    console.error('[useSearch] Failed to load search history:', e);
  }
  return [];
}

function saveSearchHistory(history: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
  } catch (e) {
    console.error('[useSearch] Failed to save search history:', e);
  }
}

function addToSearchHistory(query: string) {
  if (!query.trim()) return;

  const history = loadSearchHistory();
  // Remove if already exists (to move to top)
  const filtered = history.filter((q) => q !== query);
  // Add to front
  filtered.unshift(query);
  saveSearchHistory(filtered);
}

export function useSearch({
  activeFileId,
  activePanelId,
  layers,
  layersFunctionalHash,
  lineCount,
  searchMatchCount,
  setProcessedCache,
}: UseSearchProps): UseSearchReturn {
  // === per-tab 搜索状态（zustand store，按 activePanelId 路由）===
  // 切 tab 时 activePanelId 变化 → 各状态自动读回该面板上次的词/配置/rank
  const tab = useSearchStore((s) => (activePanelId ? s.tabs[activePanelId] : null));
  const ensureTab = useSearchStore((s) => s.ensureTab);
  const setQuery = useSearchStore((s) => s.setQuery);
  const setConfig = useSearchStore((s) => s.setConfig);
  const setCurrentMatch = useSearchStore((s) => s.setCurrentMatch);
  const setIsSearchingStore = useSearchStore((s) => s.setIsSearching);
  const setFindVisible = useSearchStore((s) => s.setFindVisible);
  const clearSearchStore = useSearchStore((s) => s.clearSearch);

  useEffect(() => {
    if (activePanelId) ensureTab(activePanelId);
  }, [activePanelId, ensureTab]);

  const searchQuery = tab?.query ?? '';
  const searchConfig = useMemo<SearchConfig>(
    () =>
      tab?.config ?? {
        regex: false,
        caseSensitive: false,
        wholeWord: false,
        mode: 'highlight' as SearchMode,
      },
    [tab?.config],
  );
  const currentMatchRank = tab?.currentMatchRank ?? -1;
  const currentMatchIndex = tab?.currentMatchIndex ?? -1;
  const isSearching = tab?.isSearching ?? false;

  // Search history (localStorage，全局共享)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());

  // Sync with backend when layers or search changes
  // 仅当该面板自身 query 相对其上次值变化（新搜索）才重置 rank；
  // 切 tab（activePanelId 变化）不重置，保留各面板导航位置。
  const lastQueryByPanelRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!activeFileId) return;

    const isNewSearch =
      !activePanelId || searchQuery !== lastQueryByPanelRef.current[activePanelId];
    if (activePanelId) lastQueryByPanelRef.current[activePanelId] = searchQuery;

    const timer = setTimeout(async () => {
      const searchConf = searchQuery
        ? {
            query: searchQuery,
            regex: searchConfig.regex,
            caseSensitive: searchConfig.caseSensitive,
          }
        : null;

      if (searchQuery && isNewSearch) {
        setIsSearchingStore(activePanelId, true);
        setCurrentMatch(activePanelId, -1, -1);

        // Clear current matches to indicate loading
        setProcessedCache((prev) => ({
          ...prev,
          [activeFileId]: { ...prev[activeFileId], searchMatchCount: 0 },
        }));
      }

      await syncAll(activeFileId, layers, searchConf);
      timingLog('sync_all.request', activeFileId, searchConf ? 'search' : 'no-search');

      if (!searchQuery) {
        setIsSearchingStore(activePanelId, false);
        setCurrentMatch(activePanelId, -1, -1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    layersFunctionalHash,
    searchQuery,
    searchConfig,
    activeFileId,
    activePanelId,
    lineCount,
    setProcessedCache,
    setIsSearchingStore,
    setCurrentMatch,
  ]);

  // Current match number (1-indexed position)
  const currentMatchNumber = useMemo(() => {
    if (currentMatchRank === -1 || !searchQuery) return 0;
    return currentMatchRank + 1;
  }, [currentMatchRank, searchQuery]);

  // Find next/prev match
  const findNextSearchMatch = useCallback(
    async (direction: 'next' | 'prev', fromIndex?: number | null): Promise<number> => {
      // [MODIFIED] Robust check - searchQuery and activeFileId are mandatory.
      // searchMatchCount might be 0 in current render but we still want to try backend jump if fromIndex is provided.
      if (!searchQuery || !activeFileId) return -1;

      const { getSearchMatchIndex, getNearestSearchRank } = await import('../bridge_client');

      let nextRank = -1;

      // Logic: If fromIndex is provided (e.g., current highlighted/cursor line),
      // we find the nearest match from there. Otherwise we use currentMatchRank.
      const effectiveCurrentIndex = fromIndex !== undefined && fromIndex !== null ? fromIndex : -1;

      if (effectiveCurrentIndex !== -1) {
        // Use backend to find nearest match rank from current line
        nextRank = await getNearestSearchRank(activeFileId, effectiveCurrentIndex, direction);
      } else {
        // Sequential navigation - requires matchCount to be > 0
        if (searchMatchCount === 0) return -1;

        if (currentMatchRank === -1) {
          // If no current match, jump to first/last based on direction
          nextRank = direction === 'next' ? 0 : searchMatchCount - 1;
        } else {
          if (direction === 'next') {
            nextRank = (currentMatchRank + 1) % searchMatchCount;
          } else {
            nextRank = (currentMatchRank - 1 + searchMatchCount) % searchMatchCount;
          }
        }
      }

      // Final safety check for rank validity
      if (nextRank !== -1) {
        const index = await getSearchMatchIndex(activeFileId, nextRank);
        setCurrentMatch(activePanelId, nextRank, index);
        return index;
      }

      return -1;
    },
    [searchQuery, searchMatchCount, currentMatchRank, activeFileId, activePanelId, setCurrentMatch],
  );

  // Wrapper for setSearchQuery that saves to history when query changes
  const setSearchQueryWrapped = useCallback(
    (query: string) => {
      if (!activePanelId) return;
      setQuery(activePanelId, query);
      // Save to history when starting a new search (non-empty query after being empty)
      if (query.trim() && query !== searchQuery) {
        addToSearchHistory(query);
        setSearchHistory(loadSearchHistory());
      }
    },
    [activePanelId, setQuery, searchQuery],
  );

  // Jump to specific rank (returns physical line index, -1 on failure)
  const jumpToRank = useCallback(
    async (rank: number): Promise<number> => {
      if (!searchQuery || !activeFileId || rank < 0) return -1;
      const { getSearchMatchIndex } = await import('../bridge_client');
      const index = await getSearchMatchIndex(activeFileId, rank);
      if (index === -1) return -1;
      setCurrentMatch(activePanelId, rank, index);
      return index;
    },
    [searchQuery, activeFileId, activePanelId, setCurrentMatch],
  );

  // Clear search
  const clearSearch = useCallback(() => {
    clearSearchStore(activePanelId);
  }, [activePanelId, clearSearchStore]);

  // Clear search history
  const clearSearchHistory = useCallback(() => {
    saveSearchHistory([]);
    setSearchHistory([]);
  }, []);

  // Remove item from search history
  const removeFromSearchHistory = useCallback((queryToRemove: string) => {
    const history = loadSearchHistory().filter((q) => q !== queryToRemove);
    saveSearchHistory(history);
    setSearchHistory(history);
  }, []);

  // F3/Shift+F3 keyboard shortcuts for search result navigation
  useEffect(() => {
    const handleF3 = async (e: KeyboardEvent) => {
      if (e.key !== 'F3') return;
      e.preventDefault();

      const direction = e.shiftKey ? 'prev' : 'next';
      await findNextSearchMatch(direction);
    };

    window.addEventListener('keydown', handleF3);
    return () => window.removeEventListener('keydown', handleF3);
  }, [findNextSearchMatch]);

  return {
    searchQuery,
    setSearchQuery: setSearchQueryWrapped,
    searchConfig,
    setSearchConfig: (patch: React.SetStateAction<SearchConfig>) => {
      const next = typeof patch === 'function' ? patch(searchConfig) : patch;
      setConfig(activePanelId, next);
    },
    currentMatchRank,
    setCurrentMatchRank: (rank: number) => setCurrentMatch(activePanelId, rank, currentMatchIndex),
    currentMatchIndex,
    isSearching,
    setIsSearching: (searching: boolean) => setIsSearchingStore(activePanelId, searching),
    searchMatchCount,
    currentMatchNumber,
    searchHistory,
    clearSearchHistory,
    removeFromSearchHistory,
    findNextSearchMatch,
    jumpToRank,
    clearSearch,
  };
}
