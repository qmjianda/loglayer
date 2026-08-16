/**
 * InspectorPanel 布局重构验收测试（layer-interaction-redesign 阶段 4）
 *
 * 追溯 spec: right-inspector-panel → "文件属性摘要" / "图层区完整交互" / "图层预设管理" / "移除独立统计视图"
 * - 未选中图层时属性区显示文件摘要；选中时切换为配置表单
 * - 图层列表在下、属性区在上；列表可滚动
 * - 独立"预设"折叠区移除，预设出现在"添加图层"下拉
 * - "统计"占位折叠区移除
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InspectorPanel } from './InspectorPanel';
import { LayerType } from '../types';
import type { LogLayer, LayerPreset, LogLevelStats } from '../types';

vi.mock('../hooks/useLayerRegistry', () => ({
  useLayerRegistry: () => ({
    registry: {
      HIGHLIGHT: {
        type: 'HIGHLIGHT',
        display_name: '高亮',
        description: '',
        icon: 'highlight',
        is_builtin: true,
        ui_schema: [
          { name: 'query', type: 'search', display_name: '匹配文本' },
          { name: 'color', type: 'color', display_name: '图层颜色' },
        ],
      },
    },
    loading: false,
    refresh: vi.fn(),
  }),
}));

const activeFile = {
  id: 'f1',
  name: 'app.log',
  path: '/logs/app.log',
  size: 1024,
  lineCount: 100,
  rawCount: 100,
  layers: [],
  isBridged: true,
};

const zeroStats: LogLevelStats = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0, TRACE: 0 };

const makeLayer = (overrides: Partial<LogLayer> = {}): LogLayer => ({
  id: 'l1',
  name: '高亮层',
  type: LayerType.HIGHLIGHT,
  enabled: true,
  isCollapsed: false,
  config: { query: 'ERROR', color: '#ef4444' },
  ...overrides,
});

interface PanelHarness {
  onLayerUpdate: ReturnType<typeof vi.fn>;
  onPresetApply: ReturnType<typeof vi.fn>;
}

const renderPanel = (opts: {
  layers?: LogLayer[];
  selectedLayerId?: string | null;
  presets?: LayerPreset[];
}): PanelHarness => {
  const onLayerUpdate = vi.fn();
  const onPresetApply = vi.fn();
  render(
    <InspectorPanel
      activeFile={activeFile}
      layers={opts.layers ?? []}
      selectedLayerId={opts.selectedLayerId ?? null}
      setSelectedLayerId={vi.fn()}
      layerStats={{}}
      onLayerRemove={vi.fn()}
      onLayerToggle={vi.fn()}
      onLayerUpdate={onLayerUpdate}
      onLayerDrop={vi.fn()}
      onAddLayer={vi.fn()}
      onJumpToLine={vi.fn()}
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      presets={opts.presets ?? []}
      onPresetApply={onPresetApply}
      onPresetDelete={vi.fn()}
      onSavePresetWithName={vi.fn()}
      saveStatus="idle"
      bookmarks={{}}
      bookmarkPreviews={{}}
      onToggleBookmark={vi.fn()}
      onClearBookmarks={vi.fn()}
      onJumpToBookmark={vi.fn()}
      logLevelStats={zeroStats}
      statsLoading={false}
    />,
  );
  return { onLayerUpdate, onPresetApply };
};

describe('InspectorPanel 属性区两用（文件属性摘要 / 图层区完整交互）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未选中图层时属性区显示文件摘要', () => {
    renderPanel({});
    expect(screen.getByText('app.log')).toBeTruthy();
    expect(screen.getByText('/logs/app.log')).toBeTruthy();
    expect(screen.getByTestId('summary-stats')).toBeTruthy();
  });

  it('选中图层时属性区显示配置表单（搜索输入框出现）', async () => {
    renderPanel({ layers: [makeLayer()], selectedLayerId: 'l1' });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('匹配文本')).toBeTruthy();
    });
    expect(screen.queryByText('/logs/app.log')).toBeNull();
  });

  it('未选中图层时属性区不显示配置表单', async () => {
    renderPanel({ layers: [makeLayer()], selectedLayerId: null });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('匹配文本')).toBeNull();
    });
  });

  it('点击图层列表空白处取消选中并恢复文件摘要', async () => {
    const setSelectedLayerId = vi.fn();
    render(
      <InspectorPanel
        activeFile={activeFile}
        layers={[makeLayer()]}
        selectedLayerId="l1"
        setSelectedLayerId={setSelectedLayerId}
        layerStats={{}}
        onLayerRemove={vi.fn()}
        onLayerToggle={vi.fn()}
        onLayerUpdate={vi.fn()}
        onLayerDrop={vi.fn()}
        onAddLayer={vi.fn()}
        onJumpToLine={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        presets={[]}
        onPresetApply={vi.fn()}
        onPresetDelete={vi.fn()}
        onSavePresetWithName={vi.fn()}
        saveStatus="idle"
        bookmarks={{}}
        bookmarkPreviews={{}}
        onToggleBookmark={vi.fn()}
        onClearBookmarks={vi.fn()}
        onJumpToBookmark={vi.fn()}
        logLevelStats={zeroStats}
        statsLoading={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('匹配文本')).toBeTruthy();
    });

    // 图层列表区空白点击（标题栏"图层"折叠头区域之外的列表空白）
    const listArea = document.querySelector('.flex.flex-col.select-none');
    expect(listArea).toBeTruthy();
    fireEvent.click(listArea!);
    expect(setSelectedLayerId).toHaveBeenCalledWith(null);
  });

  it('属性区关闭按钮取消选中（恢复文件摘要）', async () => {
    const setSelectedLayerId = vi.fn();
    render(
      <InspectorPanel
        activeFile={activeFile}
        layers={[makeLayer()]}
        selectedLayerId="l1"
        setSelectedLayerId={setSelectedLayerId}
        layerStats={{}}
        onLayerRemove={vi.fn()}
        onLayerToggle={vi.fn()}
        onLayerUpdate={vi.fn()}
        onLayerDrop={vi.fn()}
        onAddLayer={vi.fn()}
        onJumpToLine={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        presets={[]}
        onPresetApply={vi.fn()}
        onPresetDelete={vi.fn()}
        onSavePresetWithName={vi.fn()}
        saveStatus="idle"
        bookmarks={{}}
        bookmarkPreviews={{}}
        onToggleBookmark={vi.fn()}
        onClearBookmarks={vi.fn()}
        onJumpToBookmark={vi.fn()}
        logLevelStats={zeroStats}
        statsLoading={false}
      />,
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText('匹配文本')).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle('关闭配置，显示文件摘要'));
    expect(setSelectedLayerId).toHaveBeenCalledWith(null);
  });
});

describe('InspectorPanel 预设与统计区（图层预设管理 / 移除独立统计视图）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('不存在独立的"统计"折叠区', () => {
    renderPanel({});
    expect(screen.queryByText(/统计信息（第二版迭代）/)).toBeNull();
    expect(screen.queryByRole('heading', { name: /统计/ })).toBeNull();
  });

  it('不存在独立的"预设"折叠区', () => {
    renderPanel({ presets: [{ id: 'p1', name: '我的预设', layers: [makeLayer()] }] });
    expect(screen.queryByText('我的预设')).toBeNull();
    expect(screen.queryByText(/暂无预设/)).toBeNull();
  });

  it('预设出现在"添加图层"下拉中', async () => {
    const { onPresetApply } = renderPanel({
      presets: [{ id: 'p1', name: '我的预设', layers: [makeLayer()] }],
    });

    fireEvent.mouseDown(screen.getByTitle('添加图层'));
    expect(await screen.findByText('我的预设')).toBeTruthy();

    fireEvent.mouseDown(screen.getByText('我的预设'));
    expect(onPresetApply).toHaveBeenCalledWith(expect.objectContaining({ name: '我的预设' }));
  });
});
