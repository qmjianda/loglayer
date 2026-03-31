import { themes, getTheme as _getTheme, getAllThemes as _getAllThemes, isValidTheme as _isValidTheme, ThemeDefinition } from './theme/definitions';
import { generateCSSVariables, applyTheme } from './theme/css-generator';

export type ThemeMode = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'githubDark';
export type Theme = ThemeDefinition;

function createColorObj(colors: ThemeDefinition['colors']) {
  return {
    ...colors,
    color: colors.semantic,
  };
}

export const DARK_THEME = createColorObj(themes.dark.colors);
export const LIGHT_THEME = createColorObj(themes.light.colors);
export const LOG_VIEWER_COLORS = {
  DARK: themes.dark.logViewer,
  LIGHT: themes.light.logViewer,
};

export const FILE_ICON_COLORS: Record<string, string> = {
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

export function getThemeColors(mode: ThemeMode) {
  return createColorObj(themes[mode]?.colors || themes.dark.colors);
}

export function getLogViewerColors(mode: ThemeMode) {
  return themes[mode]?.logViewer || themes.dark.logViewer;
}

export function getTheme(id: string): ThemeDefinition {
  return _getTheme(id) || themes.dark;
}

export const getAllThemes = _getAllThemes;
export const isValidTheme = _isValidTheme;
export const setCssVariables = applyTheme;

export function getThemeById(id: string) {
  return _getTheme(id);
}

export function isValidThemeId(id: string): id is ThemeMode {
  return _isValidTheme(id);
}

export function getAllThemesList() {
  return _getAllThemes();
}

export { generateCSSVariables, applyTheme };
export { themes };
