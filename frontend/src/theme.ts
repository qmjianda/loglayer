import { THEME_PRESETS } from './theme/presets';

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
};

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
};

export const LOG_VIEWER_COLORS = {
  DARK: {
    BACKGROUND: '#1e1e1e',
    GUTTER: '#1e1e1e',
    GUTTER_TEXT: '#666666',
    GUTTER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
    HIGHLIGHT_LINE: 'rgba(34, 211, 238, 0.15)',
    HOVER_LINE: 'rgba(255, 255, 255, 0.03)',
    BOOKMARK_BACKGROUND: 'rgba(245, 158, 11, 0.08)',
    BOOKMARK_INDICATOR: '#fbbf24',
    SELECTION: 'rgba(245, 158, 11, 0.45)',
    TEXT: '#d4d4d4',
    RULER: '#252526',
    RULER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
    RULER_VIEWPORT: 'rgba(255, 255, 255, 0.08)',
    SEARCH_HIGHLIGHT: '#facc15',
    SEARCH_HIGHLIGHT_ACTIVE: '#ff9632',
    LAYER_HIGHLIGHT: '#3b82f6',
    WORD_HIGHLIGHT: 'rgba(6, 182, 212, 0.35)',
    CURRENT_LINE: '#60a5fa',
    JUMP_PULSE: 'rgba(34, 197, 94, 0.3)',
    JUMP_PULSE_BORDER: '#22c55e',
    CONTEXT_MENU: '#2d2d2d',
    CONTEXT_MENU_BORDER: '#404040',
  },
  LIGHT: {
    BACKGROUND: '#ffffff',
    GUTTER: '#f3f3f3',
    GUTTER_TEXT: '#6e6e6e',
    GUTTER_SEPARATOR: 'rgba(0, 0, 0, 0.08)',
    HIGHLIGHT_LINE: 'rgba(6, 182, 212, 0.15)',
    HOVER_LINE: 'rgba(0, 0, 0, 0.03)',
    BOOKMARK_BACKGROUND: 'rgba(245, 158, 11, 0.08)',
    BOOKMARK_INDICATOR: '#d97706',
    SELECTION: 'rgba(180, 120, 0, 0.35)',
    TEXT: '#1f2937',
    RULER: '#e5e5e5',
    RULER_SEPARATOR: 'rgba(0, 0, 0, 0.08)',
    RULER_VIEWPORT: 'rgba(0, 0, 0, 0.06)',
    SEARCH_HIGHLIGHT: '#eab308',
    SEARCH_HIGHLIGHT_ACTIVE: '#e67700',
    LAYER_HIGHLIGHT: '#2563eb',
    WORD_HIGHLIGHT: 'rgba(6, 182, 212, 0.35)',
    CURRENT_LINE: '#3b82f6',
    JUMP_PULSE: 'rgba(34, 197, 94, 0.2)',
    JUMP_PULSE_BORDER: '#16a34a',
    CONTEXT_MENU: '#ffffff',
    CONTEXT_MENU_BORDER: '#d1d5db',
  },
};

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
};

export type ThemeMode = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'githubDark';

export interface Theme {
  id: ThemeMode;
  name: string;
  colors: typeof DARK_THEME;
  logViewer: typeof LOG_VIEWER_COLORS.DARK;
}

const THEMES: Theme[] = [
  { id: 'dark', name: 'Dark', colors: DARK_THEME, logViewer: LOG_VIEWER_COLORS.DARK },
  { id: 'light', name: 'Light', colors: LIGHT_THEME, logViewer: LOG_VIEWER_COLORS.LIGHT },
  { id: 'monokai', name: 'Monokai', colors: THEME_PRESETS.monokai.colors, logViewer: THEME_PRESETS.monokai.logViewer },
  { id: 'dracula', name: 'Dracula', colors: THEME_PRESETS.dracula.colors, logViewer: THEME_PRESETS.dracula.logViewer },
  { id: 'nord', name: 'Nord', colors: THEME_PRESETS.nord.colors, logViewer: THEME_PRESETS.nord.logViewer },
  { id: 'githubDark', name: 'GitHub Dark', colors: THEME_PRESETS.githubDark.colors, logViewer: THEME_PRESETS.githubDark.logViewer },
];

const themesById: Record<ThemeMode, Theme> = THEMES.reduce((acc, theme) => {
  acc[theme.id] = theme;
  return acc;
}, {} as Record<ThemeMode, Theme>);

export function getThemeColors(mode: ThemeMode): typeof DARK_THEME {
  return themesById[mode]?.colors || DARK_THEME;
}

export function getLogViewerColors(mode: ThemeMode): typeof LOG_VIEWER_COLORS.DARK {
  return themesById[mode]?.logViewer || LOG_VIEWER_COLORS.DARK;
}

export function getTheme(mode: ThemeMode): Theme {
  return themesById[mode] || themesById.dark;
}

export function getAllThemes(): Theme[] {
  return THEMES;
}

export function getThemeById(id: ThemeMode): Theme | undefined {
  return themesById[id];
}

export function isValidTheme(id: string): id is ThemeMode {
  return id in themesById;
}

export function setCssVariables(theme: Theme): void {
  const root = document.documentElement;

  root.style.setProperty('--bg-primary', theme.colors.background.primary);
  root.style.setProperty('--bg-secondary', theme.colors.background.secondary);
  root.style.setProperty('--bg-tertiary', theme.colors.background.tertiary);
  root.style.setProperty('--bg-elevated', theme.colors.background.elevated);

  root.style.setProperty('--fg-primary', theme.colors.foreground.primary);
  root.style.setProperty('--fg-secondary', theme.colors.foreground.secondary);
  root.style.setProperty('--fg-muted', theme.colors.foreground.muted);

  root.style.setProperty('--border-default', theme.colors.border.default);
  root.style.setProperty('--border-subtle', theme.colors.border.subtle);

  root.style.setProperty('--color-primary', theme.colors.color.primary);
  root.style.setProperty('--color-success', theme.colors.color.success);
  root.style.setProperty('--color-warning', theme.colors.color.warning);
  root.style.setProperty('--color-error', theme.colors.color.error);
  root.style.setProperty('--color-info', theme.colors.color.info);

  root.style.setProperty('--input-background', theme.colors.input.background);
  root.style.setProperty('--input-hover', theme.colors.input.hover);
  root.style.setProperty('--input-active', theme.colors.input.active);

  root.style.setProperty('--log-bg', theme.logViewer.BACKGROUND);
  root.style.setProperty('--log-gutter', theme.logViewer.GUTTER);
  root.style.setProperty('--log-text', theme.logViewer.TEXT);
  root.style.setProperty('--log-selection', theme.logViewer.SELECTION);
  root.style.setProperty('--log-highlight', theme.logViewer.HIGHLIGHT_LINE);
  root.style.setProperty('--log-search', theme.logViewer.SEARCH_HIGHLIGHT);
  root.style.setProperty('--log-layer', theme.logViewer.LAYER_HIGHLIGHT);
  root.style.setProperty('--log-current-line', theme.logViewer.CURRENT_LINE);
  root.style.setProperty('--log-bookmark', theme.logViewer.BOOKMARK_INDICATOR);
}
