/**
 * remote-dialog-fallback 验收测试：打开文件夹入口统一回退
 *
 * 追溯 spec: remote-dialog-fallback → "打开文件夹入口统一回退" / "回退选择的语义一致性" / "回退选择结果生效"
 * - 无原生对话框（--no-ui 远程模式）时，统一编排自动回退到远程选择器
 * - 有原生对话框时走原生选择，取消无副作用
 * - 远程选择结果：目录设为工作区根目录、文件直接打开
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileActions } from './useFileActions';
import * as bridgeClient from '../bridge_client';

vi.mock('../bridge_client', async () => ({
  ...(await vi.importActual<typeof import('../bridge_client')>('../bridge_client')),
  hasNativeDialogs: vi.fn(),
}));

const mockedHasDialogs = vi.mocked(bridgeClient.hasNativeDialogs);

const baseDeps = () => ({
  dockApiRef: { current: null },
  files: [],
  handleFileActivate: vi.fn(),
  handleNativeFolderSelect: vi.fn(),
  setWorkspaceRoot: vi.fn(),
  openRemotePicker: vi.fn(),
  handleOpenFileByPath: vi.fn(),
});

describe('useFileActions 打开文件夹统一回退（remote-dialog-fallback）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('暴露统一的 handleOpenFolder 编排函数', () => {
    const deps = baseDeps();
    const { result } = renderHook(() => useFileActions(deps));
    expect(typeof result.current.handleOpenFolder).toBe('function');
  });

  it('远程模式（无原生对话框）触发 openRemotePicker 回退', async () => {
    mockedHasDialogs.mockResolvedValue(false);
    const deps = baseDeps();
    const { result } = renderHook(() => useFileActions(deps));

    await result.current.handleOpenFolder();

    expect(deps.openRemotePicker).toHaveBeenCalledTimes(1);
    expect(deps.handleNativeFolderSelect).not.toHaveBeenCalled();
  });

  it('桌面模式（有原生对话框）走原生选择并设置工作区', async () => {
    mockedHasDialogs.mockResolvedValue(true);
    const deps = baseDeps();
    deps.handleNativeFolderSelect.mockResolvedValue({ path: 'C:\\logs', name: 'logs' });
    const { result } = renderHook(() => useFileActions(deps));

    await result.current.handleOpenFolder();

    expect(deps.handleNativeFolderSelect).toHaveBeenCalledTimes(1);
    expect(deps.setWorkspaceRoot).toHaveBeenCalledWith({ path: 'C:\\logs', name: 'logs' });
    expect(deps.openRemotePicker).not.toHaveBeenCalled();
  });

  it('桌面模式下用户取消：不设工作区、不弹远程选择器（取消无副作用）', async () => {
    mockedHasDialogs.mockResolvedValue(true);
    const deps = baseDeps();
    deps.handleNativeFolderSelect.mockResolvedValue(null);
    const { result } = renderHook(() => useFileActions(deps));

    await result.current.handleOpenFolder();

    expect(deps.setWorkspaceRoot).not.toHaveBeenCalled();
    expect(deps.openRemotePicker).not.toHaveBeenCalled();
  });

  it('远程模式选中目录：设为工作区根目录', () => {
    mockedHasDialogs.mockResolvedValue(false);
    const deps = baseDeps();
    const { result } = renderHook(() => useFileActions(deps));

    return result.current.handleOpenFolder().then(() => {
      const cb = deps.openRemotePicker.mock.calls[0][0] as (r: {
        path: string;
        isDir: boolean;
      }) => void;
      cb({ path: '/var/log/app', isDir: true });
      expect(deps.setWorkspaceRoot).toHaveBeenCalledWith({ path: '/var/log/app', name: 'app' });
      expect(deps.handleOpenFileByPath).not.toHaveBeenCalled();
    });
  });

  it('远程模式选中文件：直接作为日志文件打开', () => {
    mockedHasDialogs.mockResolvedValue(false);
    const deps = baseDeps();
    const { result } = renderHook(() => useFileActions(deps));

    return result.current.handleOpenFolder().then(() => {
      const cb = deps.openRemotePicker.mock.calls[0][0] as (r: {
        path: string;
        isDir: boolean;
      }) => void;
      cb({ path: '/var/log/app/server.log', isDir: false });
      expect(deps.handleOpenFileByPath).toHaveBeenCalledWith('/var/log/app/server.log', 'server.log');
      expect(deps.setWorkspaceRoot).not.toHaveBeenCalled();
    });
  });
});
