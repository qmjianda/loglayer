/**
 * LayersPanel 选中与重命名语义验收测试（layer-interaction-redesign 阶段 1）
 *
 * 追溯 spec: layer-interaction → "图层选中与重命名语义"
 * - 单击选中，再次单击取消选中（恢复文件摘要）
 * - 双击与铅笔重命名：双击标题或悬停铅笔图标进入编辑，Enter 提交、Escape 取消
 * - 折叠仅走箭头：折叠/展开只由箭头按钮触发，单击图层项不改变折叠状态
 *
 * 阶段 3：图层项信息显示（spec: layer-interaction → "图层项信息显示"）
 * - 含颜色配置的图层显示真实配置色标识（非类型写死色）
 * - 颜色跟随配置变更即时更新
 * - 标题行显示匹配文本预览（超宽截断），计数徽章保留
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayersPanel } from './LayersPanel';
import { LayerType } from '../types';
import type { LogLayer } from '../types';

// 使 useLayerRegistry 返回空注册表（避免依赖后端）
vi.mock('../hooks/useLayerRegistry', () => ({
  useLayerRegistry: () => ({ registry: {}, loading: false, refresh: vi.fn() }),
}));

const makeLayer = (overrides: Partial<LogLayer> = {}): LogLayer => ({
  id: 'l1',
  name: '高亮层',
  type: LayerType.HIGHLIGHT,
  enabled: true,
  isCollapsed: false,
  config: { query: 'ERROR', color: '#ef4444' },
  ...overrides,
});

interface Harness {
  onUpdate: ReturnType<typeof vi.fn>;
  onSelect: ReturnType<typeof vi.fn>;
  rerender: (layers: LogLayer[], selectedId: string | null) => void;
}

const renderPanel = (
  layers: LogLayer[],
  selectedId: string | null,
  stats: Record<string, { count: number; distribution: number[] }> = {},
): Harness => {
  const onUpdate = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <LayersPanel
      layers={layers}
      stats={stats}
      selectedId={selectedId}
      onSelect={onSelect}
      onUpdate={onUpdate}
      onRemove={vi.fn()}
      onToggle={vi.fn()}
      onDrop={vi.fn()}
    />,
  );
  return {
    onUpdate,
    onSelect,
    rerender: (nextLayers, nextSelectedId) =>
      utils.rerender(
        <LayersPanel
          layers={nextLayers}
          stats={stats}
          selectedId={nextSelectedId}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
          onToggle={vi.fn()}
          onDrop={vi.fn()}
        />,
      ),
  };
};

describe('LayersPanel 图层选中与重命名语义（图层选中与重命名语义）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('再次单击已选中的图层取消选中（恢复文件摘要）', () => {
    const layer = makeLayer({ isCollapsed: false });
    const { onUpdate, onSelect } = renderPanel([layer], 'l1');

    fireEvent.click(screen.getByText('高亮层'));

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('单击未选中的已展开图层仅触发选中，不改变折叠状态', () => {
    const layer = makeLayer({ isCollapsed: false });
    const { onUpdate, onSelect } = renderPanel([layer], null);

    fireEvent.click(screen.getByText('高亮层'));

    expect(onSelect).toHaveBeenCalledWith('l1');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('单击未选中但已折叠的图层时展开（选中后可见配置），但不进入编辑', () => {
    const layer = makeLayer({ isCollapsed: true });
    const { onUpdate, onSelect } = renderPanel([layer], null);

    fireEvent.click(screen.getByText('高亮层'));

    // 选择新图层时展开它（允许配置可见）
    expect(onUpdate).toHaveBeenCalledWith('l1', { isCollapsed: false });
    expect(onSelect).toHaveBeenCalledWith('l1');
  });

  it('双击标题进入重命名编辑态，Enter 提交新名称', () => {
    const layer = makeLayer({ name: '旧名' });
    const { onUpdate } = renderPanel([layer], 'l1');

    fireEvent.doubleClick(screen.getByText('旧名'));
    const input = screen.getByDisplayValue('旧名') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: '新名' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdate).toHaveBeenCalledWith('l1', { name: '新名' });
  });

  it('双击进入编辑后按 Escape 取消，不提交修改', () => {
    const layer = makeLayer({ name: '旧名' });
    const { onUpdate } = renderPanel([layer], 'l1');

    fireEvent.doubleClick(screen.getByText('旧名'));
    const input = screen.getByDisplayValue('旧名') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '不该生效' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('悬停出现的铅笔图标点击进入重命名编辑态', () => {
    const layer = makeLayer({ name: '高亮层' });
    const { onUpdate } = renderPanel([layer], 'l1');

    const pencil = screen.getByTitle('重命名');
    fireEvent.click(pencil);

    const input = screen.getByDisplayValue('高亮层') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: '铅笔改名' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('l1', { name: '铅笔改名' });
  });

  it('折叠/展开仅由文件夹图层的箭头按钮触发', () => {
    const folder = makeLayer({ type: LayerType.FOLDER, name: '分组', isCollapsed: false });
    const { onUpdate } = renderPanel([folder], null);

    const arrow = screen.getByTitle('折叠');
    fireEvent.click(arrow);

    expect(onUpdate).toHaveBeenCalledWith(folder.id, { isCollapsed: true });
  });

  it('非文件夹图层不渲染折叠箭头', () => {
    const layer = makeLayer({ isCollapsed: false });
    renderPanel([layer], 'l1');
    expect(screen.queryByTitle('折叠')).toBeNull();
  });
});

describe('LayersPanel 图层项信息显示（图层项信息显示）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('含颜色配置的图层显示真实配置色标识', () => {
    const layer = makeLayer({ config: { query: 'ERROR', color: '#ef4444' } });
    renderPanel([layer], 'l1');

    const icon = screen.getByTestId(`layer-color-${layer.id}`);
    expect(icon.style.color).toBe('rgb(239, 68, 68)'); // #ef4444
  });

  it('颜色跟随配置变更即时更新', () => {
    const layer = makeLayer({ config: { query: 'ERROR', color: '#ef4444' } });
    const { rerender } = renderPanel([layer], 'l1');

    rerender([{ ...layer, config: { query: 'ERROR', color: '#22c55e' } }], 'l1');
    const icon = screen.getByTestId(`layer-color-${layer.id}`);
    expect(icon.style.color).toBe('rgb(34, 197, 94)'); // #22c55e
  });

  it('无颜色配置的图层不显示配置色标识', () => {
    const layer = makeLayer({ type: LayerType.FILTER, config: { query: 'ERROR' } });
    renderPanel([layer], 'l1');

    const icon = screen.getByTestId(`layer-color-${layer.id}`);
    expect(icon.style.color).toBe('');
  });

  it('标题行显示匹配文本预览', () => {
    const layer = makeLayer({ config: { query: 'ERROR timeout', color: '#ef4444' } });
    renderPanel([layer], 'l1');

    expect(screen.getByText('ERROR timeout')).toBeTruthy();
  });

  it('匹配文本超宽时截断（不溢出布局）', () => {
    const longQuery = 'A'.repeat(200);
    const layer = makeLayer({ config: { query: longQuery, color: '#ef4444' } });
    renderPanel([layer], 'l1');

    const preview = screen.getByTestId(`layer-preview-${layer.id}`);
    expect(preview.textContent).toBe(longQuery);
    expect(preview.className).toContain('truncate');
  });

  it('计数徽章保留显示匹配数', () => {
    const layer = makeLayer({ config: { query: 'ERROR', color: '#ef4444' } });
    renderPanel([layer], 'l1', { l1: { count: 1234, distribution: [] } });

    expect(screen.getByText('1,234')).toBeTruthy();
  });
});
