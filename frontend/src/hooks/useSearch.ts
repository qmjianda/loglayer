/**
 * useSearch - Search state and operations hook
 * 
 * Manages search query, config, match navigation, and sync with backend.
 * Includes local state management and F3 keyboard shortcuts.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { syncAll } from '../bridge_client';
import { LogLayer } from '../types';

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

    // Operations
    findNextSearchMatch: (direction: 'next' | 'prev', fromIndex?: number | null) => Promise<number>;
    clearSearch: () => void;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchConfig, setSearchConfig] = useState<SearchConfig>({
        regex: false,
        caseSensitive: false,
        wholeWord: false,
        mode: 'highlight'
    });
    
    const [currentMatchRank, setCurrentMatchRank] = useState(-1);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);

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
    const findNextSearchMatch = useCallback(async (direction: 'next' | 'prev', fromIndex?: number | null): Promise<number> => {
        // [MODIFIED] Robust check - searchQuery and activeFileId are mandatory.
        // searchMatchCount might be 0 in current render but we still want to try backend jump if fromIndex is provided.
        if (!searchQuery || !activeFileId) return -1;

        const { getSearchMatchIndex, getNearestSearchRank } = await import('../bridge_client');

        let nextRank = -1;

        // Logic: If fromIndex is provided (e.g., current highlighted/cursor line),
        // we find the nearest match from there. Otherwise we use currentMatchRank.
        const effectiveCurrentIndex = (fromIndex !== undefined && fromIndex !== null) ? fromIndex : -1;

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
            setCurrentMatchRank(nextRank);
            const index = await getSearchMatchIndex(activeFileId, nextRank);
            setCurrentMatchIndex(index);
            return index;
        }

        return -1;
    }, [searchQuery, searchMatchCount, currentMatchRank, activeFileId]);

    // Clear search
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setCurrentMatchRank(-1);
        setCurrentMatchIndex(-1);
        setIsSearching(false);
    }, [setSearchQuery]);

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
        setSearchQuery,
        searchConfig,
        setSearchConfig,
        currentMatchRank,
        setCurrentMatchRank,
        currentMatchIndex,
        isSearching,
        setIsSearching,
        searchMatchCount,
        currentMatchNumber,
        findNextSearchMatch,
        clearSearch
    };
}
