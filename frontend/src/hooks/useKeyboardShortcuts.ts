import { useCallback } from 'react';
import { MAX_PANES } from './usePaneManagement';
import { useShortcut } from '../shortcuts';

interface UseKeyboardShortcutsParams {
  handleToggleWatch: () => void;
  setIsSettingsVisible: (visible: boolean) => void;
  setIsCommandPaletteVisible: (visible: boolean) => void;
  splitPane: (paneId: string, fileId?: string, direction?: 'right' | 'bottom') => void;
  removePane: (paneId: string) => void;
  activePaneId: string;
  panes: Array<{ id: string }>;
}

export const useKeyboardShortcuts = ({
  handleToggleWatch,
  setIsSettingsVisible,
  setIsCommandPaletteVisible,
  splitPane,
  removePane,
  activePaneId,
  panes
}: UseKeyboardShortcutsParams) => {
  useShortcut('commandPalette', useCallback(() => {
    setIsCommandPaletteVisible(true);
  }, [setIsCommandPaletteVisible]));

  useShortcut('toggleWatch', useCallback(() => {
    handleToggleWatch();
  }, [handleToggleWatch]));

  useShortcut('openSettings', useCallback(() => {
    setIsSettingsVisible(true);
  }, [setIsSettingsVisible]));

  const handleSplitRight = useCallback(() => {
    if (panes.length < MAX_PANES) {
      splitPane(activePaneId, undefined, 'right');
    }
  }, [splitPane, activePaneId, panes.length]);
  useShortcut('splitPaneRight', handleSplitRight);

  const handleSplitBottom = useCallback(() => {
    if (panes.length < MAX_PANES) {
      splitPane(activePaneId, undefined, 'bottom');
    }
  }, [splitPane, activePaneId, panes.length]);
  useShortcut('splitPaneBottom', handleSplitBottom);

  const handleClosePane = useCallback(() => {
    if (panes.length > 1) {
      removePane(activePaneId);
    }
  }, [removePane, activePaneId, panes.length]);
  useShortcut('closePane', handleClosePane);
};