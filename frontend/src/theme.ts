export const DARK_THEME = {
  background: {
    primary: '#0d0d0d',
    secondary: '#1e1e1e',
    tertiary: '#252526',
    elevated: '#2d2d2d',
  },
  foreground: {
    primary: '#e5e5e5',
    secondary: '#a1a1a1',
    muted: '#6b7280',
  },
  border: {
    default: '#444444',
    subtle: '#333333',
  },
  color: {
    primary: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  input: {
    background: '#3c3c3c',
    hover: '#2a2d2e',
    active: '#37373d',
  },
} as const;

export const LIGHT_THEME = {
  background: {
    primary: '#f8fafc',
    secondary: '#ffffff',
    tertiary: '#f1f5f9',
    elevated: '#e2e8f0',
  },
  foreground: {
    primary: '#0f172a',
    secondary: '#334155',
    muted: '#64748b',
  },
  border: {
    default: '#cbd5e1',
    subtle: '#e2e8f0',
  },
  color: {
    primary: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  input: {
    background: '#f1f5f9',
    hover: '#e2e8f0',
    active: '#cbd5e1',
  },
} as const;

export const LOG_VIEWER_COLORS = {
  DARK: {
    BACKGROUND: '#1e1e1e',
    GUTTER: '#1e1e1e',
    GUTTER_TEXT: '#666666',
    HIGHLIGHT_LINE: 'rgba(34, 211, 238, 0.15)',
    BOOKMARK_BACKGROUND: 'rgba(245, 158, 11, 0.08)',
    BOOKMARK_INDICATOR: '#fbbf24',
    SELECTION: 'rgba(245, 158, 11, 0.45)',
    TEXT: '#d4d4d4',
    RULER: '#252526',
    SEARCH_HIGHLIGHT: '#facc15',
    LAYER_HIGHLIGHT: '#3b82f6',
    CURRENT_LINE: '#60a5fa',
  },
  LIGHT: {
    BACKGROUND: '#ffffff',
    GUTTER: '#f3f3f3',
    GUTTER_TEXT: '#6e6e6e',
    HIGHLIGHT_LINE: 'rgba(6, 182, 212, 0.15)',
    BOOKMARK_BACKGROUND: 'rgba(245, 158, 11, 0.08)',
    BOOKMARK_INDICATOR: '#d97706',
    SELECTION: 'rgba(180, 120, 0, 0.35)',
    TEXT: '#1f2937',
    RULER: '#e5e5e5',
    SEARCH_HIGHLIGHT: '#eab308',
    LAYER_HIGHLIGHT: '#2563eb',
    CURRENT_LINE: '#3b82f6',
  },
} as const;

export const FILE_ICON_COLORS = {
  gitignore: '#f1502f',
  json: '#facc15',
  js: '#f7df1e',
  sh: '#4caf50',
  py: '#3776ab',
  md: '#007acc',
  ts: '#3178c6',
  tsconfig: '#3178c6',
  vite: '#bd34fe',
  folder: '#858585',
  default: '#858585',
} as const;

export type ThemeMode = 'dark' | 'light';

export function getThemeColors(mode: ThemeMode) {
  return mode === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getLogViewerColors(mode: ThemeMode) {
  return mode === 'dark' ? LOG_VIEWER_COLORS.DARK : LOG_VIEWER_COLORS.LIGHT;
}
