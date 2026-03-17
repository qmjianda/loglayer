import { useState, useCallback } from 'react';
import { getLogLevelStats } from '../bridge_client';

export interface LogLevelStats {
  ERROR: number;
  WARN: number;
  INFO: number;
  DEBUG: number;
  TRACE: number;
  FATAL?: number;
}

export interface Notification {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AppModalsState {
  isCommandPaletteVisible: boolean;
  isSettingsVisible: boolean;
  isShortcutsVisible: boolean;
  isExportDialogOpen: boolean;
  isStorageSettingsOpen: boolean;
  isWorkerConfigOpen: boolean;
  isPluginManagerOpen: boolean;
  notification: Notification | null;
}

export interface AppModalsActions {
  setIsCommandPaletteVisible: (v: boolean) => void;
  setIsSettingsVisible: (v: boolean) => void;
  setIsShortcutsVisible: (v: boolean) => void;
  setIsExportDialogOpen: (v: boolean) => void;
  setIsStorageSettingsOpen: (v: boolean) => void;
  setIsWorkerConfigOpen: (v: boolean) => void;
  setIsPluginManagerOpen: (v: boolean) => void;
  showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearNotification: () => void;
}

export interface UseAppModalsReturn extends AppModalsState, AppModalsActions {}

export function useAppModals(): UseAppModalsReturn {
  const [isCommandPaletteVisible, setIsCommandPaletteVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isShortcutsVisible, setIsShortcutsVisible] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isStorageSettingsOpen, setIsStorageSettingsOpen] = useState(false);
  const [isWorkerConfigOpen, setIsWorkerConfigOpen] = useState(false);
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotification = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return {
    isCommandPaletteVisible,
    isSettingsVisible,
    isShortcutsVisible,
    isExportDialogOpen,
    isStorageSettingsOpen,
    isWorkerConfigOpen,
    isPluginManagerOpen,
    notification,
    setIsCommandPaletteVisible,
    setIsSettingsVisible,
    setIsShortcutsVisible,
    setIsExportDialogOpen,
    setIsStorageSettingsOpen,
    setIsWorkerConfigOpen,
    setIsPluginManagerOpen,
    showNotification,
    clearNotification,
  };
}

export function useLogLevelStats(activeFileId: string | null) {
  const [logLevelStats, setLogLevelStats] = useState<LogLevelStats>({
    ERROR: 0,
    WARN: 0,
    INFO: 0,
    DEBUG: 0,
    TRACE: 0
  });

  const fetchStats = useCallback(async () => {
    if (!activeFileId) {
      setLogLevelStats({ ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 });
      return;
    }

    try {
      const stats = await getLogLevelStats(activeFileId);
      setLogLevelStats({
        ERROR: stats.ERROR || 0,
        WARN: stats.WARN || 0,
        INFO: stats.INFO || 0,
        DEBUG: stats.DEBUG || 0,
        TRACE: stats.TRACE || 0,
        FATAL: stats.FATAL || 0
      });
    } catch (e) {
      console.error('[useLogLevelStats] Failed to fetch:', e);
    }
  }, [activeFileId]);

  return { logLevelStats, setLogLevelStats, fetchStats };
}