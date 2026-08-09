/**
 * useBridge - Core hook for backend communication via REST + WebSockets
 *
 * This hook initializes the bridge connection and provides callback registration
 * for all backend signals. Other hooks should use the callbacks to update their state.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { initBridge } from '../bridge_client';
import { FileBridgeAPI } from '../types';

// Types for bridge callbacks
export interface FileLoadedInfo {
  name: string;
  size: number;
  lineCount: number;
  path?: string;
}

export interface PipelineResult {
  fileId: string;
  newTotal: number;
  matchCount: number;
}

export interface LayerStats {
  [layerId: string]: {
    count: number;
    distribution: number[];
  };
}

export interface OperationStatus {
  op: string;
  progress: number;
  error?: string;
}

export interface BridgeCallbacks {
  onFileLoaded?: (fileId: string, info: FileLoadedInfo) => void;
  onPipelineFinished?: (fileId: string, newTotal: number, matchCount: number) => void;
  onStatsFinished?: (fileId: string, stats: LayerStats) => void;
  onOperationStarted?: (fileId: string, op: string) => void;
  onOperationProgress?: (fileId: string, op: string, progress: number) => void;
  onOperationError?: (fileId: string, op: string, message: string) => void;
  onPendingFilesCount?: (count: number) => void;
  onWorkspaceOpened?: (path: string) => void;
}

export interface UseBridgeReturn {
  bridgeReady: boolean;
  bridgeApi: FileBridgeAPI | null;
  activeFileIdRef: React.MutableRefObject<string | null>;
  setActiveFileId: (fileId: string | null) => void;
}

// 模块级防重标志：StrictMode 双挂载/effect 重入时，同一桥实例只注册一次信号回调
const registeredSignals = new Set<FileBridgeAPI>();

export function useBridge(callbacks: BridgeCallbacks): UseBridgeReturn {
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeApi, setBridgeApi] = useState<FileBridgeAPI | null>(null);
  const activeFileIdRef = useRef<string | null>(null);

  // Store callbacks in refs to avoid re-initializing bridge on callback changes
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const setActiveFileId = useCallback((fileId: string | null) => {
    activeFileIdRef.current = fileId;
  }, []);

  // Initialize Bridge - runs only once on mount
  // StrictMode 开发模式会双挂载 effect：initBridge().then 里的 connect 若重复执行，
  // 同一回调会被注册两遍（实测每个信号回调执行 2 次）。用模块级标志防重 + cleanup 断开。
  useEffect(() => {
    let disposed = false;
    let apiInstance: FileBridgeAPI | null = null;

    const onFileLoaded = (fileId: string, rawInfo: any) => {
      try {
        const info = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
        callbacksRef.current.onFileLoaded?.(fileId, info);
      } catch (e) {
        console.error('[useBridge] Failed to parse fileLoaded info:', e);
      }
    };
    const onPipelineFinished = (fileId: string, newTotal: number, matchCount: number) => {
      callbacksRef.current.onPipelineFinished?.(fileId, newTotal, matchCount);
    };
    const onStatsFinished = (fileId: string, statsJson: string) => {
      try {
        const stats = typeof statsJson === 'string' ? JSON.parse(statsJson) : statsJson;
        callbacksRef.current.onStatsFinished?.(fileId, stats);
      } catch (e) {
        console.error('[useBridge] Stats parse error:', e);
      }
    };
    const onOperationStarted = (fileId: string, op: string) => {
      callbacksRef.current.onOperationStarted?.(fileId, op);
    };
    const onOperationProgress = (fileId: string, op: string, progress: number) => {
      callbacksRef.current.onOperationProgress?.(fileId, op, progress);
    };
    const onOperationError = (fileId: string, op: string, message: string) => {
      callbacksRef.current.onOperationError?.(fileId, op, message);
    };
    const onPendingFilesCount = (count: number) => {
      callbacksRef.current.onPendingFilesCount?.(count);
    };
    const onWorkspaceOpened = (path: string) => {
      callbacksRef.current.onWorkspaceOpened?.(path);
    };

    const connects: Array<[string, (...args: any[]) => void]> = [
      ['fileLoaded', onFileLoaded],
      ['pipelineFinished', onPipelineFinished],
      ['statsFinished', onStatsFinished],
      ['operationStarted', onOperationStarted],
      ['operationProgress', onOperationProgress],
      ['operationError', onOperationError],
      ['pendingFilesCount', onPendingFilesCount],
      ['workspaceOpened', onWorkspaceOpened],
    ];

    initBridge().then((api) => {
      if (!api || disposed) return;
      if (registeredSignals.has(api)) {
        setBridgeApi(api);
        setBridgeReady(true);
        return;
      }
      registeredSignals.add(api);
      apiInstance = api;
      connects.forEach(([name, cb]) => (api as any)[name]?.connect?.(cb));
      setBridgeApi(api);

      // Notify backend that frontend is ready
      api.ready();
      setBridgeReady(true);
    });

    return () => {
      disposed = true;
      if (apiInstance) {
        connects.forEach(([name, cb]) => (apiInstance as any)[name]?.disconnect?.(cb));
        registeredSignals.delete(apiInstance);
        apiInstance = null;
      }
    };
  }, []); // Initialize only once

  return {
    bridgeReady,
    bridgeApi,
    activeFileIdRef,
    setActiveFileId,
  };
}
