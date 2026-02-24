import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl } from '../utils';

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
}

export function useFileWatch(onNewContent?: (fileInfo: FileInfo) => void): UseFileWatchReturn {
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
        const newLines = lineCount - lastLineCountRef.current;
        
        if (newLines > 0 || mtime !== lastMtimeRef.current) {
          setHasNewContent(true);
          setNewContentCount(prev => prev + newLines);
          lastMtimeRef.current = mtime;
          lastLineCountRef.current = lineCount;
          
          onNewContent?.(data);
        }
      }
    } catch (err) {
      console.error('[FileWatch] Error checking for changes:', err);
    }
  }, [onNewContent]);

  const startWatching = useCallback((fileId: string) => {
    fileIdRef.current = fileId;
    setIsWatching(true);
    setHasNewContent(false);
    setNewContentCount(0);
    
    // Check immediately
    checkForChanges();
    
    // Poll every 2 seconds
    intervalRef.current = window.setInterval(checkForChanges, 2000);
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

  return {
    isWatching,
    startWatching,
    stopWatching,
    hasNewContent,
    newContentCount
  };
}
