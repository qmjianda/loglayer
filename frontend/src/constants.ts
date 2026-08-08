export const LOG_VIEWER = {
  LINE_HEIGHT: 20,
  GUTTER_WIDTH: 80,
  BUFFER_NORMAL: 800,
  BUFFER_LARGE: 1500,
  VIRTUAL_HEIGHT_LIMIT: 10_000_000,
  MAX_CACHED_LINES: 5000,
  RULER_WIDTH: 12,
  CHAR_WIDTH_DEFAULT: 7.22 as number,
  FONT: '12px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  FONT_GUTTER: '10px "JetBrains Mono", monospace',
  WHEEL_LINES_PER_TICK: 3,
  SCROLL_MARGIN: 100,
  CACHE_CLEAR_DISTANCE: 3000,
  FETCH_DEBOUNCE_MS: 50,
  // Performance tuning
  TARGET_FPS: 60,
  IDLE_THRESHOLD_MS: 100,
  RENDER_BATCH_SIZE: 100,
  MEMORY_WARNING_THRESHOLD_MB: 500,
  CACHE_PRUNE_ON_IDLE: true,
  LAZY_LOAD_THRESHOLD: 1000,
} as const;

// ==== 双行号 gutter（fix-bookmark-filter-index）====
/** 等宽数字字符宽 = fontSize * 0.6（JetBrains Mono 等宽字体 ch≈0.6em） */
export function gutterCharWidth(fontSize: number): number {
  return fontSize * 0.6;
}
/** 书签星标槽位宽 = ceil(fontSize * 1.2)：★/● 全角 ≈1em，1.2 系数留字形余量，独立占位保证不覆盖行号 */
export function gutterStarSlot(fontSize: number): number {
  return Math.ceil(fontSize * 1.2);
}
/** 列内侧留白（px，与字号无关的布局间距） */
export const GUTTER_PADDING = 4;

/**
 * 行号列宽字符数：按 toLocaleString 千分位格式后的显示宽度计算
 * （如 10,000,000 为 10 字符），否则长行号溢出会遮挡相邻列。
 */
export function gutterDigits(n: number, min: number): number {
  return Math.max(min, Math.max(1, n).toLocaleString('en-US').length);
}

/**
 * gutter 总宽（px）。物理列 = 星标槽 + 物理位数(下限3)；虚拟列 = 序号位数(下限2)，
 * virtualVisible=false 时折叠为 0。LogViewer(popover 定位) 与 LogRow(行内布局) 共用。
 * 尺寸按实际 fontSize 计算，避免长行号（千万行）溢出遮挡星标/虚拟列。
 */
export function computeGutterWidth(
  rawLineCount: number,
  totalLines: number,
  virtualVisible: boolean,
  fontSize = 12
): number {
  const char = gutterCharWidth(fontSize);
  const star = gutterStarSlot(fontSize);
  const physDigits = gutterDigits(rawLineCount, 3);
  const virtDigits = gutterDigits(totalLines, 2);
  const physWidth = physDigits * char + star + GUTTER_PADDING;
  const virtWidth = virtualVisible ? virtDigits * char + GUTTER_PADDING : 0;
  // +2 余量：LogRow 内部含 paddingLeft/borderLeft，理论总宽略大于列宽之和
  return Math.round(physWidth + virtWidth + 2);
}

export const KEYBOARD_SHORTCUTS = {
  GO_TO_LINE: { key: 'g', modifier: 'ctrl' },
  SELECT_LINE: { key: 'l', modifier: 'ctrlShift' },
  JUMP_TO_SELECTION: { key: 'Enter', modifier: 'ctrl' },
  MOVE_SELECTION_UP: { key: 'ArrowUp', modifier: 'alt' },
  MOVE_SELECTION_DOWN: { key: 'ArrowDown', modifier: 'alt' },
  SELECT_ALL: { key: 'a', modifier: 'ctrl' },
} as const;
