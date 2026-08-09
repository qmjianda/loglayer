/**
 * 跳转定位的滚动决策（对齐 VS Code `revealPositionInCenterIfOutsideViewport`）
 *
 * 规则（A2 / 边缘安全区语义）：
 * - 目标行在视口边缘安全区外完整可见（[topVisibleLine+1, topVisibleLine+visibleRows-1]）
 *   → 返回 null（不滚动，仅由 highlightedIndex 更新高亮）
 * - 目标行贴近视口顶部/底部（1 行安全区内）或完全在视口外
 *   → 居中滚动，目标行定位到视口正中（viewportHeight / 2）
 * - 目标为最后一行时居中目标值超过 maxLogicalScroll，clamp 后即贴底（watch 滚底场景）
 *
 * 行级近似的安全区对应 VS Code `_computeScrollTopToRevealRange` 中
 * `paddingTop = 1 * lineHeight` 的像素判断（`viewportStartY <= boxStartY && boxEndY <= viewportEndY`）。
 */

/**
 * 计算跳转目标行应滚动到的物理 scrollTop。
 * @param topVisibleLine 视口顶部可见行索引（逻辑坐标，floor 近似）
 * @param visibleRows    视口可见行数（固定行高近似）
 * @param viewportHeight 视口高度（px）
 * @param lineHeight     行高（px）
 * @param targetIndex    跳转目标行索引
 * @param maxLogicalScroll 最大逻辑滚动量（px）
 * @param maxPhysicalScroll 最大物理滚动量（px，useScaling 压缩后）
 * @param useScaling     是否启用亿行滚动缩放
 * @returns 目标物理 scrollTop；目标行在安全区外完整可见时返回 null（不滚动）
 */
export function computeRevealScrollTop(
  topVisibleLine: number,
  visibleRows: number,
  viewportHeight: number,
  lineHeight: number,
  targetIndex: number,
  maxLogicalScroll: number,
  maxPhysicalScroll: number,
  useScaling: boolean,
): number | null {
  // 边缘安全区（上下各 1 行，对应 VS Code `paddingTop = 1 * lineHeight`）：
  // 目标行在此区间外完整可见 → 不滚动，仅高亮
  const safeZoneStart = topVisibleLine + 1;
  const safeZoneEnd = topVisibleLine + visibleRows - 1;
  if (targetIndex >= safeZoneStart && targetIndex <= safeZoneEnd) {
    return null;
  }

  // 居中：目标行定位到视口正中（1/2，对应 VS Code `boxMiddleY - viewportHeight / 2`）
  const targetLogical = Math.max(0, targetIndex * lineHeight - viewportHeight / 2);
  const targetPhysical =
    useScaling && maxLogicalScroll > 0
      ? (targetLogical / maxLogicalScroll) * maxPhysicalScroll
      : targetLogical;
  // clamp 到合法滚动范围：末行（或文件头）目标值超界时自然贴底/贴顶
  return Math.max(0, Math.min(targetPhysical, maxPhysicalScroll));
}
