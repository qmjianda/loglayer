/**
 * 静态对称预取区间计算。
 *
 * 返回「区间起点 ± M」且 clamp 到 [0, totalLines) 的连续行区间 { start, end }。
 * 无方向、无速度、无动态——成熟参照 AG Grid cacheBlockSize（按需拉取一块）。
 *
 * @param top        区间起点（视口顶部可见行 / 渲染窗口起点，逻辑坐标）
 * @param span       区间跨度（视口可见行数 / 渲染窗口大小）
 * @param M          预取余量（行，配置常量 LOG_VIEWER.PREFETCH_BUFFER）
 * @param totalLines 总行数
 */
export function computePrefetchRange(
  top: number,
  span: number,
  M: number,
  totalLines: number,
): { start: number; end: number } {
  const start = Math.max(0, top - M);
  const end = Math.min(totalLines, top + span + M);
  return { start, end };
}
