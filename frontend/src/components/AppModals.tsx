import React from 'react';
import { CommandPalette, Command } from './CommandPalette';
import { RemotePathPicker } from './RemotePathPicker';
import { KeyboardShortcutsPanel } from './KeyboardShortcutsPanel';
import { SettingsPanel } from './SettingsPanel';

interface Notification {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

interface AppModalsProps {
  isRemotePickerOpen: boolean;
  remotePickerMode: any;
  listDirectory: any;
  handleRemotePickerClose: any;
  handleRemotePathSelected: any;
  commands: any;
  isCommandPaletteVisible: boolean;
  setIsCommandPaletteVisible: any;
  isSettingsVisible: boolean;
  setIsSettingsVisible: any;
  isShortcutsVisible: boolean;
  setIsShortcutsVisible: any;
  notification: any;
}

export const AppModals: React.FC<AppModalsProps> = ({
  isRemotePickerOpen,
  remotePickerMode,
  listDirectory,
  handleRemotePickerClose,
  handleRemotePathSelected,
  commands,
  isCommandPaletteVisible,
  setIsCommandPaletteVisible,
  isSettingsVisible,
  setIsSettingsVisible,
  isShortcutsVisible,
  setIsShortcutsVisible,
  notification
}) => {
  const getRemotePickerTitle = () => {
    if (remotePickerMode === 'folder') return '选择文件夹';
    if (remotePickerMode === 'file') return '选择文件';
    return '选择路径';
  };

  return (
    <>
      <RemotePathPicker
        open={isRemotePickerOpen}
        onOpenChange={handleRemotePickerClose}
        onSelect={handleRemotePathSelected}
        mode={remotePickerMode}
        title={getRemotePickerTitle()}
        listDirectory={listDirectory}
      />

      <CommandPalette
        commands={commands}
        isOpen={isCommandPaletteVisible}
        onClose={() => setIsCommandPaletteVisible(false)}
      />

      <SettingsPanel
        isOpen={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />

      <KeyboardShortcutsPanel
        isOpen={isShortcutsVisible}
        onClose={() => setIsShortcutsVisible(false)}
      />

      {notification && (
        <div className="fixed bottom-16 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-4 py-3 rounded-lg shadow-lg border ${
            notification.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
            notification.type === 'warning' ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' :
            notification.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
            'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}>
            <div className="text-sm font-medium">{notification.message}</div>
          </div>
        </div>
      )}
    </>
  );
};
