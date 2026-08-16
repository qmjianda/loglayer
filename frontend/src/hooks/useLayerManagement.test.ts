/**
 * applyPreset 预设应用结构完整性验收测试（layer-interaction-redesign BUG 修复）
 *
 * 追溯 spec: right-inspector-panel → "图层预设管理"
 * BUG 复现：默认预设含 FOLDER + 子图层，应用后子图层 groupId 指向不存在的
 * FOLDER → 列表按 groupId 递归渲染时不可见，但数据生效（文本被过滤）。
 *
 * 修复验收：
 * - 应用含 FOLDER 的预设后，FOLDER 被创建，子图层挂在 FOLDER 下（可见）
 * - 应用不含 FOLDER 的预设后，子图层为顶层（groupId=undefined，可见）
 * - 合并语义保持：同 kind 同 name 图层启用而非重复添加
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayerManagement } from './useLayerManagement';
import { LayerType } from '../types';
import type { LogLayer, LayerPreset, FileData } from '../types';

vi.mock('./useLayerRegistry', () => ({
  useLayerRegistry: () => ({ registry: {}, loading: false, refresh: vi.fn() }),
}));

const makeFile = (layers: LogLayer[]): FileData => ({
  id: 'f1',
  name: 'app.log',
  path: '/logs/app.log',
  size: 1024,
  lineCount: 100,
  rawCount: 100,
  layers,
  isBridged: true,
});

const baseProps = (file: FileData) => ({
  activeFileId: file.id,
  activeFile: file,
  files: [file],
  setFiles: vi.fn(),
  searchQuery: '',
  searchConfig: { regex: false, caseSensitive: false },
});

const folderPreset: LayerPreset = {
  id: 'p1',
  name: '默认预设',
  layers: [
    {
      id: 'folder-1',
      name: '系统日志',
      type: LayerType.FOLDER,
      enabled: true,
      isCollapsed: false,
      config: {},
    },
    {
      id: '1',
      name: '仅限错误',
      type: LayerType.LEVEL,
      enabled: true,
      groupId: 'folder-1',
      config: { levels: ['ERROR', 'FATAL'] },
    },
  ],
};

describe('applyPreset 预设应用（图层预设管理）', () => {
  it('应用含 FOLDER 的预设：FOLDER 被创建，子图层挂在其下（不产生孤儿）', () => {
    const file = makeFile([]);
    const props = baseProps(file);
    const { result } = renderHook(() => useLayerManagement(props));

    act(() => {
      result.current.applyPreset(folderPreset);
    });

    // 捕获 setFiles 更新后的 layers
    const setFilesCall = props.setFiles.mock.calls[0][0];
    let applied: LogLayer[] = [];
    act(() => {
      applied = setFilesCall([file]).find((f: FileData) => f.id === 'f1').layers;
    });

    const folder = applied.find((l) => l.type === LayerType.FOLDER);
    expect(folder).toBeTruthy();

    const child = applied.find((l) => l.name === '仅限错误');
    expect(child).toBeTruthy();
    expect(child?.groupId).toBe(folder?.id);
  });

  it('应用后子图层可通过文件夹渲染链路到达（无 groupId 指向不存在的父节点）', () => {
    const file = makeFile([]);
    const props = baseProps(file);
    const { result } = renderHook(() => useLayerManagement(props));

    act(() => {
      result.current.applyPreset(folderPreset);
    });

    const setFilesCall = props.setFiles.mock.calls[0][0];
    let applied: LogLayer[] = [];
    act(() => {
      applied = setFilesCall([file]).find((f: FileData) => f.id === 'f1').layers;
    });

    const folderIds = new Set(applied.filter((l) => l.type === LayerType.FOLDER).map((l) => l.id));
    applied.forEach((l) => {
      if (l.groupId !== undefined) {
        expect(folderIds.has(l.groupId)).toBe(true);
      }
    });
  });

  it('当前文件已有同名 FOLDER 时，子图层挂到已存在的 FOLDER（合并语义）', () => {
    const existingFolder: LogLayer = {
      id: 'existing-folder',
      name: '系统日志',
      type: LayerType.FOLDER,
      enabled: true,
      isCollapsed: false,
      config: {},
    };
    const file = makeFile([existingFolder]);
    const props = baseProps(file);
    const { result } = renderHook(() => useLayerManagement(props));

    act(() => {
      result.current.applyPreset(folderPreset);
    });

    const setFilesCall = props.setFiles.mock.calls[0][0];
    let applied: LogLayer[] = [];
    act(() => {
      applied = setFilesCall([file]).find((f: FileData) => f.id === 'f1').layers;
    });

    // 不重复创建同名 FOLDER
    const folders = applied.filter((l) => l.type === LayerType.FOLDER);
    expect(folders).toHaveLength(1);

    const child = applied.find((l) => l.name === '仅限错误');
    expect(child?.groupId).toBe('existing-folder');
  });
});

describe('toggleLayer 文件夹启停级联（图层选中与重命名语义）', () => {
  it('关闭文件夹时 FILTER 子图层 enabled 同步为 false（后端不再过滤）', () => {
    const folder = {
      id: 'f1',
      name: '生产过滤',
      type: LayerType.FOLDER,
      enabled: true,
      isCollapsed: false,
      config: {},
    } as LogLayer;
    const filter = {
      id: 'l1',
      name: '仅限错误',
      type: LayerType.FILTER,
      enabled: true,
      groupId: 'f1',
      config: { query: 'ERROR' },
    } as LogLayer;
    const file = makeFile([folder, filter]);
    const props = baseProps(file);
    const { result } = renderHook(() => useLayerManagement(props));

    act(() => {
      result.current.toggleLayer('f1');
    });

    const setFilesCall = props.setFiles.mock.calls[0][0];
    let updated: LogLayer[] = [];
    act(() => {
      updated = setFilesCall([file]).find((f: FileData) => f.id === 'f1').layers;
    });

    expect(updated.find((l) => l.id === 'f1')?.enabled).toBe(false);
    expect(updated.find((l) => l.id === 'l1')?.enabled).toBe(false);
  });

  it('再次打开文件夹时 FILTER 子图层 enabled 同步为 true', () => {
    const folder = {
      id: 'f1',
      name: '生产过滤',
      type: LayerType.FOLDER,
      enabled: false,
      isCollapsed: false,
      config: {},
    } as LogLayer;
    const filter = {
      id: 'l1',
      name: '仅限错误',
      type: LayerType.FILTER,
      enabled: false,
      groupId: 'f1',
      config: { query: 'ERROR' },
    } as LogLayer;
    const file = makeFile([folder, filter]);
    const props = baseProps(file);
    const { result } = renderHook(() => useLayerManagement(props));

    act(() => {
      result.current.toggleLayer('f1');
    });

    const setFilesCall = props.setFiles.mock.calls[0][0];
    let updated: LogLayer[] = [];
    act(() => {
      updated = setFilesCall([file]).find((f: FileData) => f.id === 'f1').layers;
    });

    expect(updated.find((l) => l.id === 'f1')?.enabled).toBe(true);
    expect(updated.find((l) => l.id === 'l1')?.enabled).toBe(true);
  });

  it('切换普通图层（非文件夹）只影响自身', () => {
    const layer = {
      id: 'l1',
      name: '高亮',
      type: LayerType.HIGHLIGHT,
      enabled: true,
      config: { query: 'ERROR' },
    } as LogLayer;
    const file = makeFile([layer]);
    const props = baseProps(file);
    const { result } = renderHook(() => useLayerManagement(props));

    act(() => {
      result.current.toggleLayer('l1');
    });

    const setFilesCall = props.setFiles.mock.calls[0][0];
    let updated: LogLayer[] = [];
    act(() => {
      updated = setFilesCall([file]).find((f: FileData) => f.id === 'f1').layers;
    });

    expect(updated.find((l) => l.id === 'l1')?.enabled).toBe(false);
  });
});
