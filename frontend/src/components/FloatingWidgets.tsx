import React from 'react';
import { EditorFindWidget } from './EditorFindWidget';
import { EditorGoToLineWidget } from './EditorGoToLineWidget';

interface SearchConfig {
  regex: boolean;
  caseSensitive: boolean;
}

interface FloatingWidgetsProps {
  isFindVisible: boolean;
  isGoToLineVisible: boolean;
  searchQuery: string;
  searchConfig: SearchConfig;
  searchMatchCount: number;
  currentMatchNumber: number;
  totalLines: number;
  currentLine?: number;
  activeFileId: string | null;
  processedCache: any;
  onQueryChange: (query: string) => void;
  onConfigChange: (config: SearchConfig) => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  onGoToLine: (lineNum: number) => void;
  onCloseFind: () => void;
  onCloseGoToLine: () => void;
  clearSearch: () => void;
  setProcessedCache: any;
}

export const FloatingWidgets: React.FC<FloatingWidgetsProps> = ({
  isFindVisible,
  isGoToLineVisible,
  searchQuery,
  searchConfig,
  searchMatchCount,
  currentMatchNumber,
  totalLines,
  currentLine,
  activeFileId,
  onQueryChange,
  onConfigChange,
  onNavigate,
  onGoToLine,
  onCloseFind,
  onCloseGoToLine,
  clearSearch,
  setProcessedCache
}) => {
  const handleFindClose = () => {
    onCloseFind();
    clearSearch();
    if (activeFileId) {
      setProcessedCache((prev: any) => {
        const newCache = { ...prev };
        newCache[activeFileId] = {
          ...(prev[activeFileId] || { layerStats: {}, searchMatchCount: 0 }),
          searchMatchCount: 0
        };
        return newCache;
      });
    }
  };

  return (
    <>
      {isFindVisible && (
        <EditorFindWidget
          query={searchQuery}
          onQueryChange={onQueryChange}
          config={searchConfig}
          onConfigChange={onConfigChange}
          matchCount={searchMatchCount}
          currentMatch={currentMatchNumber}
          onNavigate={onNavigate}
          onClose={handleFindClose}
        />
      )}

      {isGoToLineVisible && (
        <EditorGoToLineWidget
          totalLines={totalLines}
          currentLine={currentLine}
          onGo={onGoToLine}
          onClose={onCloseGoToLine}
        />
      )}
    </>
  );
};
