import { useEffect } from 'react';
import { MAX_PANES } from '../hooks/usePaneManagement';

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isP = e.key.toLowerCase() === 'p';
      const isT = e.key.toLowerCase() === 't';
      const isComma = e.key === ',';
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      if (isCmdOrCtrl && isP && isShift) {
        e.preventDefault();
        setIsCommandPaletteVisible(true);
        return;
      }

      if (isCmdOrCtrl && isT && isShift) {
        e.preventDefault();
        handleToggleWatch();
        return;
      }

      if (isCmdOrCtrl && isComma) {
        e.preventDefault();
        setIsSettingsVisible(true);
        return;
      }

      if (isCmdOrCtrl && e.key === '\\' && !isShift) {
        e.preventDefault();
        if (panes.length < MAX_PANES) {
          splitPane(activePaneId, undefined, 'right');
        }
        return;
      }

      if (isCmdOrCtrl && e.key === '\\' && isShift) {
        e.preventDefault();
        if (panes.length < MAX_PANES) {
          splitPane(activePaneId, undefined, 'bottom');
        }
        return;
      }

      if (isCmdOrCtrl && isShift && e.key === 'ArrowRight') {
        e.preventDefault();
        if (panes.length < MAX_PANES) {
          splitPane(activePaneId, undefined, 'right');
        }
        return;
      }

      if (isCmdOrCtrl && isShift && e.key === 'ArrowDown') {
        e.preventDefault();
        if (panes.length < MAX_PANES) {
          splitPane(activePaneId, undefined, 'bottom');
        }
        return;
      }

      if (isCmdOrCtrl && e.key === 'w' && !isShift) {
        e.preventDefault();
        if (panes.length > 1) {
          removePane(activePaneId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleWatch, setIsSettingsVisible, setIsCommandPaletteVisible, splitPane, removePane, activePaneId, panes]);
};
