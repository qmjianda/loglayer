import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../utils';
import { INTERVALS } from '../constants';

export interface FileInfo {
  path: string;
  size: number;
  mtime: number;
  lineCount: number;
}

export interface UseFileWatchReturn {
  isWatching: boolean;
  startWatching: (fileId: string) => void;
  stopWatching: () => void;
  hasNewContent: boolean;
  newContentCount: number;
  clearNewContent: () => void;
}

export function useFileWatch(
  onNewContent?: (fileInfo: FileInfo) => void,
  onNewLines?: (newLineCount: number, totalLines: number) => void
): UseFileWatchReturn {
  const [isWatching, setIsWatching] = useState(false);
  const [hasNewContent, setHasNewContent] = useState(false);
  const [newContentCount, setNewContentCount] = useState(0);
  const fileIdRef = useRef<string | null>(null);
  const lastMtimeRef = useRef<number>(0);
  const lastLineCountRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  const checkForChanges = useCallback(async () => {
    const fileId = fileIdRef.current;
    if (!fileId) return;

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/file_info?file_id=${fileId}`);
      const data = await res.json();
      
      if (data.error) return;

      const mtime = data.mtime;
      const lineCount = data.lineCount;

      if (mtime !== lastMtimeRef.current || lineCount !== lastLineCountRef.current) {
        const newLines = Math.max(0, lineCount - lastLineCountRef.current);
        
        if (newLines > 0 || mtime !== lastMtimeRef.current) {
          setHasNewContent(true);
          setNewContentCount(prev => prev + newLines);
          lastMtimeRef.current = mtime;
          lastLineCountRef.current = lineCount;
          
          onNewContent?.(data);
          
          if (newLines > 0) {
            onNewLines?.(newLines, lineCount);
          }
        }
      }
    } catch (err) {
      console.error('[FileWatch] Error checking for changes:', err);
    }
  }, [onNewContent, onNewLines]);

  const startWatching = useCallback((fileId: string) => {
    fileIdRef.current = fileId;
    setIsWatching(true);
    setHasNewContent(false);
    setNewContentCount(0);
    
    // Check immediately
    checkForChanges();
    
    intervalRef.current = window.setInterval(checkForChanges, INTERVALS.FILE_WATCH_POLL_MS);
  }, [checkForChanges]);

  const stopWatching = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    fileIdRef.current = null;
    setIsWatching(false);
    setHasNewContent(false);
    setNewContentCount(0);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const clearNewContent = useCallback(() => {
    setHasNewContent(false);
    setNewContentCount(0);
  }, []);

  return {
    isWatching,
    startWatching,
    stopWatching,
    hasNewContent,
    newContentCount,
    clearNewContent
  };
}
