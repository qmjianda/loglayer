import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWorkspaceState, loadWorkspaceConfig, openFile } from '../bridge_client';
import type { WorkspaceConfig } from '../bridge_client';
import type { FileData } from './useFileManagement';
import { useWorkspaceConfig } from './useWorkspaceConfig';

vi.mock('../bridge_client', () => ({
  getWorkspaceState: vi.fn(),
  loadWorkspaceConfig: vi.fn(),
  openFile: vi.fn(),
  putWorkspaceState: vi.fn(),
  saveWorkspaceConfig: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const defer = <T>(): Deferred<T> => {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const workspaceRoot = { path: '/workspace/.loglayer', name: 'workspace' };

const savedConfig = (path: string): WorkspaceConfig => ({
  version: 2,
  lastModified: '2026-08-18T00:00:00.000Z',
  files: [
    {
      path,
      name: 'app.log',
      size: 12,
      layers: [],
      wasOpen: true,
    },
  ],
  activeFilePath: path,
});

const useRestoreHarness = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const workspace = useWorkspaceConfig({
    workspaceRoot,
    files,
    setFiles,
    activeFileId,
    setActiveFileId,
    activeFilePath: undefined,
    handleFileActivate: vi.fn(),
  });
  return { ...workspace, files };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useWorkspaceConfig 工作区恢复生命周期（fix-workspace-restore-loading-state）', () => {
  it('持久化读取未返回时保持 restoreState=pending，而不是普通空工作区', async () => {
    const config = defer<WorkspaceConfig | null>();
    vi.mocked(getWorkspaceState).mockResolvedValue(null);
    vi.mocked(loadWorkspaceConfig).mockReturnValue(config.promise);

    const { result } = renderHook(() => useRestoreHarness());

    // Given: 工作区已有保存会话，但持久化读取仍未完成
    // Then: 恢复态必须与 files=[] 的普通欢迎态可区分
    expect(result.current.files).toHaveLength(0);
    expect(Reflect.get(result.current, 'restoreState')).toBe('pending');

    await act(async () => {
      config.resolve(null);
    });
  });

  it('文件元数据返回后在 openFile 完成前建立面板数据', async () => {
    const opening = defer<boolean>();
    vi.mocked(getWorkspaceState).mockResolvedValue(null);
    vi.mocked(loadWorkspaceConfig).mockResolvedValue(savedConfig('/workspace/app.log'));
    vi.mocked(openFile).mockReturnValue(opening.promise);

    const { result } = renderHook(() => useRestoreHarness());

    // When: 工作区文件列表返回，文件打开/索引仍未完成
    await waitFor(() => expect(result.current.files).toHaveLength(1));

    // Then: 面板所需的文件元数据已经可用，恢复态已离开 pending
    expect(result.current.files[0]?.name).toBe('app.log');
    expect(result.current.files[0]?.path).toBe('/workspace/app.log');
    expect(Reflect.get(result.current, 'restoreState')).toBe('ready');
    expect(openFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      opening.resolve(true);
    });
  });

  it('没有保存会话时进入 empty，而不是误报恢复中', async () => {
    vi.mocked(getWorkspaceState).mockResolvedValue(null);
    vi.mocked(loadWorkspaceConfig).mockResolvedValue(null);

    const { result } = renderHook(() => useRestoreHarness());

    // When: 持久化状态返回且没有可恢复文件
    await waitFor(() => expect(Reflect.get(result.current, 'restoreState')).toBe('empty'));

    // Then: 普通欢迎态仍由空文件列表表示
    expect(result.current.files).toHaveLength(0);
  });

  it('恢复文件打开失败后保留历史条目且结束恢复态', async () => {
    vi.mocked(getWorkspaceState).mockResolvedValue(null);
    vi.mocked(loadWorkspaceConfig).mockResolvedValue(savedConfig('/workspace/missing.log'));
    vi.mocked(openFile).mockResolvedValue(false);

    const { result } = renderHook(() => useRestoreHarness());

    // When: 保存文件路径已失效，openFile 返回失败
    await waitFor(() => expect(result.current.files[0]?.wasOpen).toBe(false));

    // Then: 文件降级为历史条目，不再暴露永久恢复/加载状态
    expect(result.current.files[0]?.name).toBe('app.log');
    expect(Reflect.get(result.current, 'restoreState')).toBe('ready');
  });

  it('切换工作区后忽略旧工作区的迟到恢复结果', async () => {
    const firstConfig = defer<WorkspaceConfig | null>();
    vi.mocked(getWorkspaceState).mockResolvedValue(null);
    vi.mocked(loadWorkspaceConfig).mockImplementation((path) =>
      Promise.resolve(path.includes('/second/') ? null : firstConfig.promise),
    );

    const useSwitchingHarness = () => {
      const [root, setRoot] = useState({ path: '/first/.loglayer', name: 'first' });
      const [files, setFiles] = useState<FileData[]>([]);
      const [activeFileId, setActiveFileId] = useState<string | null>(null);
      const workspace = useWorkspaceConfig({
        workspaceRoot: root,
        files,
        setFiles,
        activeFileId,
        setActiveFileId,
        activeFilePath: undefined,
        handleFileActivate: vi.fn(),
      });
      return {
        ...workspace,
        files,
        switchWorkspace: () => setRoot({ path: '/second/.loglayer', name: 'second' }),
      };
    };

    const { result } = renderHook(() => useSwitchingHarness());

    await act(async () => {
      result.current.switchWorkspace();
    });
    await waitFor(() => expect(result.current.restoreState).toBe('empty'));

    await act(async () => {
      firstConfig.resolve(savedConfig('/first/app.log'));
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.restoreState).toBe('empty');
  });
});
