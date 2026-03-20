/**
 * useSearch - Search state and operations hook
 * 
 * Manages search query, config, match navigation, and sync with backend.
 * Includes local state management and F3 keyboard shortcuts.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { syncAll } from '../bridge_client';
import { LogLayer } from '../types';
import { useShortcut } from '../shortcuts';

export type SearchMode = 'highlight' | 'filter';

export interface SearchConfig {
    regex: boolean;
    caseSensitive: boolean;
    wholeWord?: boolean;
    mode?: SearchMode;
}

export interface UseSearchProps {
    activeFileId: string | null;
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
    findNextSearchMatch: (direction: 'next' | 'prev', fromIndex?: number | null, overrideMatchCount?: number) => Promise<number>;
    clearSearch: () => void;
}

// Search history management
const SEARCH_HISTORY_KEY = 'loglayer_recent_searches';
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
    const filtered = history.filter(q => q !== query);
    // Add to front
    filtered.unshift(query);
    saveSearchHistory(filtered);
}

export function useSearch({
    activeFileId,
    layers,
    layersFunctionalHash,
    lineCount,
    searchMatchCount,
    setProcessedCache
}: UseSearchProps): UseSearchReturn {
    // Search state (merged from useSearchLogic)
    const [searchQuery, setSearchQueryState] = useState('');
    const [searchConfig, setSearchConfig] = useState<SearchConfig>({
        regex: false,
        caseSensitive: false,
        wholeWord: false,
        mode: 'highlight'
    });
    
    const [currentMatchRank, setCurrentMatchRank] = useState(-1);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    
    // Search history
    const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());

    // Sync with backend when layers or search changes
    useEffect(() => {
        if (!activeFileId) return;

        const timer = setTimeout(async () => {
            const searchConf = searchQuery ? {
                query: searchQuery,
                regex: searchConfig.regex,
                caseSensitive: searchConfig.caseSensitive
            } : null;

            if (searchQuery) {
                setIsSearching(true);
                setCurrentMatchRank(-1);
                setCurrentMatchIndex(-1);

                // Clear current matches to indicate loading
                setProcessedCache(prev => ({
                    ...prev,
                    [activeFileId]: { ...prev[activeFileId], searchMatchCount: 0 }
                }));
            }

            await syncAll(activeFileId, layers, searchConf);

            if (!searchQuery) {
                setIsSearching(false);
                setCurrentMatchRank(-1);
                setCurrentMatchIndex(-1);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [layersFunctionalHash, searchQuery, searchConfig, activeFileId, lineCount]);

    // Current match number (1-indexed position)
    const currentMatchNumber = useMemo(() => {
        if (currentMatchRank === -1 || !searchQuery) return 0;
        return currentMatchRank + 1;
    }, [currentMatchRank, searchQuery]);

    // Find next/prev match
    const findNextSearchMatch = useCallback(async (direction: 'next' | 'prev', fromIndex?: number | null, overrideMatchCount?: number): Promise<number> => {
        const effectiveMatchCount = overrideMatchCount ?? searchMatchCount;
        
        if (!searchQuery || !activeFileId) {
            return -1;
        }

        if (effectiveMatchCount === 0) {
            return -1;
        }

        const { getSearchMatchIndex, getNearestSearchRank } = await import('../bridge_client');

        let nextRank = -1;

        if (fromIndex !== undefined && fromIndex !== null) {
            nextRank = await getNearestSearchRank(activeFileId, fromIndex, direction);
        } else if (currentMatchRank === -1) {
            nextRank = direction === 'next' ? 0 : effectiveMatchCount - 1;
        } else {
            if (direction === 'next') {
                nextRank = (currentMatchRank + 1) % effectiveMatchCount;
            } else {
                nextRank = (currentMatchRank - 1 + effectiveMatchCount) % effectiveMatchCount;
            }
        }

        if (nextRank !== -1 && nextRank < effectiveMatchCount) {
            setCurrentMatchRank(nextRank);
            const index = await getSearchMatchIndex(activeFileId, nextRank);
            setCurrentMatchIndex(index);
            return index;
        }

        return -1;
    }, [searchQuery, searchMatchCount, currentMatchRank, activeFileId]);

    // Wrapper for setSearchQuery that saves to history when query changes
    const setSearchQueryWrapped = useCallback((query: string) => {
        setSearchQueryState(query);
        // Save to history when starting a new search (non-empty query after being empty)
        if (query.trim() && query !== searchQuery) {
            addToSearchHistory(query);
            setSearchHistory(loadSearchHistory());
        }
    }, [searchQuery]);

    // Clear search
    const clearSearch = useCallback(() => {
        setSearchQueryState('');
        setCurrentMatchRank(-1);
        setCurrentMatchIndex(-1);
        setIsSearching(false);
    }, []);

    // Clear search history
    const clearSearchHistory = useCallback(() => {
        saveSearchHistory([]);
        setSearchHistory([]);
    }, []);

    // Remove item from search history
    const removeFromSearchHistory = useCallback((queryToRemove: string) => {
        const history = loadSearchHistory().filter(q => q !== queryToRemove);
        saveSearchHistory(history);
        setSearchHistory(history);
    }, []);

    useShortcut('findNext', useCallback(async () => {
        await findNextSearchMatch('next');
    }, [findNextSearchMatch]));

    useShortcut('findPrev', useCallback(async () => {
        await findNextSearchMatch('prev');
    }, [findNextSearchMatch]));

    return {
        searchQuery,
        setSearchQuery: setSearchQueryWrapped,
        searchConfig,
        setSearchConfig,
        currentMatchRank,
        setCurrentMatchRank,
        currentMatchIndex,
        isSearching,
        setIsSearching,
        searchMatchCount,
        currentMatchNumber,
        searchHistory,
        clearSearchHistory,
        removeFromSearchHistory,
        findNextSearchMatch,
        clearSearch
    };
}
