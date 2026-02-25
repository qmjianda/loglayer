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

export const KEYBOARD_SHORTCUTS = {
  GO_TO_LINE: { key: 'g', modifier: 'ctrl' },
  SELECT_LINE: { key: 'l', modifier: 'ctrlShift' },
  JUMP_TO_SELECTION: { key: 'Enter', modifier: 'ctrl' },
  MOVE_SELECTION_UP: { key: 'ArrowUp', modifier: 'alt' },
  MOVE_SELECTION_DOWN: { key: 'ArrowDown', modifier: 'alt' },
  SELECT_ALL: { key: 'a', modifier: 'ctrl' },
} as const;
