import type { LogLayer } from '../types';

/**
 * 判断图层是否"有效启用"（layer-interaction-redesign 文件夹级联）。
 * 需递归检查父文件夹 enabled：子图层 enabled 且所有祖先文件夹均 enabled 才算生效。
 * 用于前端渲染过滤（LogRow）与面板状态显示，保持"文件夹启停同步子层"语义一致。
 */
export function isLayerEffectivelyEnabled(
  layer: LogLayer,
  layersById: Map<string, LogLayer>,
): boolean {
  if (!layer.enabled || layer.isSystemManaged) return false;
  if (!layer.groupId) return true;
  const parent = layersById.get(layer.groupId);
  if (!parent) return true;
  return isLayerEffectivelyEnabled(parent, layersById);
}

export function buildLayersById(layers: LogLayer[]): Map<string, LogLayer> {
  return new Map(layers.map((l) => [l.id, l]));
}
