/**
 * AppOverlays - 应用级浮层（refactor-app-orchestration）。
 *
 * 承载：跳转行号浮层、远程路径选择器、命令面板、设置面板、诊断浮层、快捷键面板。
 * 从 App.tsx 提取，通过 props 契约接收状态与回调。
 */
import React from 'react';
import { RemotePathPicker } from '../RemotePathPicker';
import { CommandPalette, Command } from '../CommandPalette';
import { SettingsPanel } from '../SettingsPanel';
import { DebugOverlay } from '../DebugOverlay';
import { KeyboardShortcutsPanel } from '../KeyboardShortcutsPanel';
import { EditorGoToLineWidget } from '../EditorGoToLineWidget';

interface DirectoryItemShape {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

export interface AppOverlaysProps {
  isRemotePickerOpen: boolean;
  remotePickerMode: 'folder' | 'file' | 'both';
  onRemotePickerClose: (open: boolean) => void;
  onRemotePathSelected: (path: string, isDir: boolean) => void;
  remoteListDirectory: (path: string) => Promise<DirectoryItemShape[]>;
  commands: Command[];
  isCommandPaletteVisible: boolean;
  setIsCommandPaletteVisible: (v: boolean) => void;
  isSettingsVisible: boolean;
  setIsSettingsVisible: (v: boolean) => void;
  isDebugVisible: boolean;
  setIsDebugVisible: (v: boolean) => void;
  isShortcutsVisible: boolean;
  setIsShortcutsVisible: (v: boolean) => void;
  isGoToLineVisible: boolean;
  setIsGoToLineVisible: (v: boolean) => void;
  /** Ctrl+G 幂等守卫计数：已打开时递增 → 既有输入框重新聚焦 */
  goToLineFocusRequest: number;
  totalLines: number;
  onGoToLine: (lineNum: number) => void;
}

export const AppOverlays: React.FC<AppOverlaysProps> = ({
  isRemotePickerOpen,
  remotePickerMode,
  onRemotePickerClose,
  onRemotePathSelected,
  remoteListDirectory,
  commands,
  isCommandPaletteVisible,
  setIsCommandPaletteVisible,
  isSettingsVisible,
  setIsSettingsVisible,
  isDebugVisible,
  setIsDebugVisible,
  isShortcutsVisible,
  setIsShortcutsVisible,
  isGoToLineVisible,
  setIsGoToLineVisible,
  goToLineFocusRequest,
  totalLines,
  onGoToLine,
}) => {
  return (
    <>
      {/* 悬浮组件：Ctrl+G 跳转行号（fixed 视口锚定，不随滚动容器移动） */}
      {isGoToLineVisible && (
        <EditorGoToLineWidget
          totalLines={totalLines}
          onGo={onGoToLine}
          onClose={() => setIsGoToLineVisible(false)}
          focusRequest={goToLineFocusRequest}
        />
      )}

      {/* 远程路径选择器 - 用于 --no-ui 模式替代原生对话框 */}
      <RemotePathPicker
        open={isRemotePickerOpen}
        onOpenChange={onRemotePickerClose}
        onSelect={onRemotePathSelected}
        mode={remotePickerMode}
        title={
          remotePickerMode === 'folder'
            ? '选择文件夹'
            : remotePickerMode === 'file'
              ? '选择文件'
              : '选择路径'
        }
        listDirectory={remoteListDirectory}
      />

      {/* 命令面板 */}
      <CommandPalette
        commands={commands}
        isOpen={isCommandPaletteVisible}
        onClose={() => setIsCommandPaletteVisible(false)}
      />

      {/* 设置面板 */}
      <SettingsPanel isOpen={isSettingsVisible} onClose={() => setIsSettingsVisible(false)} />

      {/* 诊断浮层（Ctrl+Shift+D） */}
      <DebugOverlay visible={isDebugVisible} onClose={() => setIsDebugVisible(false)} />

      {/* 快捷键参考面板 */}
      <KeyboardShortcutsPanel
        isOpen={isShortcutsVisible}
        onClose={() => setIsShortcutsVisible(false)}
      />
    </>
  );
};
