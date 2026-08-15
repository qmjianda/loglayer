/**
 * 日志视图内容对齐的 translateY 计算。
 *
 * 滚动压缩（超大文件 useScaling）下，物理 scrollTop 与逻辑滚动有 scale 倍差距，
 * 内容必须按「逻辑滚动」对齐，否则会按整行（20px）离散跳动。
 *
 * @param windowStart      渲染窗口首行逻辑行号
 * @param lineHeight       行高（px）
 * @param logicalScrollTop 逻辑滚动位置（px；非缩放时等于物理 scrollTop）
 * @param scrollTop        物理滚动位置（px）
 */
export function computeViewportTranslateY(
  windowStart: number,
  lineHeight: number,
  logicalScrollTop: number,
  scrollTop: number,
): number {
  return windowStart * lineHeight - (logicalScrollTop - scrollTop);
}
