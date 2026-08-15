/**
 * 滚轮 deltaY 归一化为逻辑像素。
 *
 * 参照 VS Code / xterm.js `StandardWheelEvent`：不同 deltaMode 的 deltaY 量纲不同，
 * 统一换算成逻辑像素后，滚动量与文件大小/缩放比解耦。
 *
 * @param deltaY        wheel 事件 deltaY
 * @param deltaMode     wheel 事件 deltaMode（0=PIXEL, 1=LINE, 2=PAGE）
 * @param lineHeight    行高（px）
 * @param viewportHeight 视口高度（px）
 */
export function wheelDeltaToLogicalPx(
  deltaY: number,
  deltaMode: number,
  lineHeight: number,
  viewportHeight: number,
): number {
  switch (deltaMode) {
    case 1: // DOM_DELTA_LINE：deltaY 已是行数
      return deltaY * lineHeight;
    case 2: // DOM_DELTA_PAGE：deltaY 是页数
      return deltaY * viewportHeight;
    case 0: // DOM_DELTA_PIXEL：deltaY 已是像素
    default:
      return deltaY;
  }
}
