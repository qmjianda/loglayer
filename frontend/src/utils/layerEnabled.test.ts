/**
 * 图层有效启用判断验收测试（layer-interaction-redesign 文件夹级联）
 *
 * 追溯 spec: layer-interaction → "图层选中与重命名语义"（文件夹启停同步子层）
 * BUG 修复：文件夹启停未同步到子图层。
 * - 子图层 enabled 但父文件夹 disabled → 有效状态为 disabled
 * - 多层嵌套：任一层祖先 disabled → 有效状态为 disabled
 * - 父文件夹不存在（孤儿）→ 按自身 enabled 判断
 */
import { describe, it, expect } from 'vitest';
import { isLayerEffectivelyEnabled, buildLayersById } from './layerEnabled';
import { LayerType } from '../types';
import type { LogLayer } from '../types';

const folder = (id: string, enabled: boolean, name = `分组${id}`): LogLayer => ({
  id,
  name,
  type: LayerType.FOLDER,
  enabled,
  isCollapsed: false,
  config: {},
});

const layer = (id: string, enabled: boolean, groupId?: string): LogLayer => ({
  id,
  name: `层${id}`,
  type: LayerType.HIGHLIGHT,
  enabled,
  groupId,
  config: {},
});

describe('isLayerEffectivelyEnabled 文件夹级联（图层选中与重命名语义）', () => {
  it('子图层 enabled + 父文件夹 enabled → 有效', () => {
    const layers = [folder('f1', true), layer('l1', true, 'f1')];
    const byId = buildLayersById(layers);
    expect(isLayerEffectivelyEnabled(layers[1], byId)).toBe(true);
  });

  it('子图层 enabled + 父文件夹 disabled → 无效（文件夹启停同步子层）', () => {
    const layers = [folder('f1', false), layer('l1', true, 'f1')];
    const byId = buildLayersById(layers);
    expect(isLayerEffectivelyEnabled(layers[1], byId)).toBe(false);
  });

  it('子图层自身 disabled → 无效（即使父文件夹 enabled）', () => {
    const layers = [folder('f1', true), layer('l1', false, 'f1')];
    const byId = buildLayersById(layers);
    expect(isLayerEffectivelyEnabled(layers[1], byId)).toBe(false);
  });

  it('多层嵌套：任一层祖先 disabled → 无效', () => {
    const layers = [folder('f1', false), folder('f2', true, '嵌套分组'), layer('l1', true, 'f2')];
    // 修正 f2 挂在 f1 下
    layers[1] = { ...layers[1], groupId: 'f1' };
    const byId = buildLayersById(layers);
    expect(isLayerEffectivelyEnabled(layers[2], byId)).toBe(false);
  });

  it('父文件夹不存在（孤儿）→ 按自身 enabled 判断', () => {
    const layers = [layer('l1', true, 'ghost')];
    const byId = buildLayersById(layers);
    expect(isLayerEffectivelyEnabled(layers[0], byId)).toBe(true);
  });
});
