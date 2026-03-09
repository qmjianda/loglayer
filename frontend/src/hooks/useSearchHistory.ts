import { useState, useCallback, useEffect, useRef } from 'react';

export interface SearchHistoryItem {
    query: string;
    timestamp: number;
    config: {
        regex: boolean;
        caseSensitive: boolean;
        wholeWord?: boolean;
    };
}

const STORAGE_KEY = 'loglayer_search_history';
const STORAGE_KEY_SETTINGS = 'loglayer_settings';

function getHistoryLimit(): number {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed.searchHistoryLimit || 50;
        }
            } catch (e) {
                console.warn('[useSearchHistory] Failed to parse search history:', e);
            }
    return 50;
}

export function useSearchHistory() {
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const limitRef = useRef(getHistoryLimit());

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSearchHistory(parsed);
    } catch (e) {
        console.warn('[useSearchHistory] Failed to parse settings:', e);
    }
        }
    }, []);

    useEffect(() => {
        limitRef.current = getHistoryLimit();
    }, [searchHistory]);

    const addToHistory = useCallback((query: string, config: SearchHistoryItem['config']) => {
        if (!query.trim()) return;
        
        setSearchHistory(prev => {
            const filtered = prev.filter(item => item.query !== query);
            const newItem: SearchHistoryItem = {
                query,
                timestamp: Date.now(),
                config
            };
            const limited = [newItem, ...filtered].slice(0, limitRef.current);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
            return limited;
        });
    }, []);

    const removeFromHistory = useCallback((index: number) => {
        setSearchHistory(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            return filtered;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setSearchHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    return {
        searchHistory,
        addToHistory,
        removeFromHistory,
        clearHistory
    };
}
