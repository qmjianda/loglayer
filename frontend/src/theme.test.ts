import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DARK_THEME,
  LIGHT_THEME,
  LOG_VIEWER_COLORS,
  FILE_ICON_COLORS,
  getThemeColors,
  getLogViewerColors,
  getTheme,
  getAllThemes,
  getThemeById,
  isValidTheme,
  setCssVariables,
  type ThemeMode,
} from './theme';

describe('theme', () => {
  describe('DARK_THEME', () => {
    it('should have required color properties', () => {
      expect(DARK_THEME.background).toBeDefined();
      expect(DARK_THEME.foreground).toBeDefined();
      expect(DARK_THEME.border).toBeDefined();
      expect(DARK_THEME.color).toBeDefined();
      expect(DARK_THEME.input).toBeDefined();
    });

    it('should have valid hex colors', () => {
      expect(DARK_THEME.background.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(DARK_THEME.color.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('LIGHT_THEME', () => {
    it('should have required color properties', () => {
      expect(LIGHT_THEME.background).toBeDefined();
      expect(LIGHT_THEME.foreground).toBeDefined();
      expect(LIGHT_THEME.border).toBeDefined();
      expect(LIGHT_THEME.color).toBeDefined();
      expect(LIGHT_THEME.input).toBeDefined();
    });

    it('should have valid hex colors', () => {
      expect(LIGHT_THEME.background.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('LOG_VIEWER_COLORS', () => {
    it('should have DARK and LIGHT variants', () => {
      expect(LOG_VIEWER_COLORS.DARK).toBeDefined();
      expect(LOG_VIEWER_COLORS.LIGHT).toBeDefined();
    });

    it('should have required log viewer properties', () => {
      const dark = LOG_VIEWER_COLORS.DARK;
      expect(dark.BACKGROUND).toBeDefined();
      expect(dark.TEXT).toBeDefined();
      expect(dark.SELECTION).toBeDefined();
      expect(dark.SEARCH_HIGHLIGHT).toBeDefined();
    });
  });

  describe('FILE_ICON_COLORS', () => {
    it('should have file extension colors', () => {
      expect(FILE_ICON_COLORS.py).toBe('#3776ab');
      expect(FILE_ICON_COLORS.js).toBe('#f7df1e');
      expect(FILE_ICON_COLORS.ts).toBe('#3178c6');
      expect(FILE_ICON_COLORS.md).toBe('#007acc');
    });

    it('should have folder and default colors', () => {
      expect(FILE_ICON_COLORS.folder).toBeDefined();
      expect(FILE_ICON_COLORS.default).toBeDefined();
    });
  });

  describe('getThemeColors', () => {
    it('should return dark theme colors', () => {
      const colors = getThemeColors('dark');
      expect(colors).toEqual(DARK_THEME);
    });

    it('should return light theme colors', () => {
      const colors = getThemeColors('light');
      expect(colors).toEqual(LIGHT_THEME);
    });

    it('should return default dark theme for unknown mode', () => {
      const colors = getThemeColors('unknown' as ThemeMode);
      expect(colors).toEqual(DARK_THEME);
    });
  });

  describe('getLogViewerColors', () => {
    it('should return dark log viewer colors', () => {
      const colors = getLogViewerColors('dark');
      expect(colors).toEqual(LOG_VIEWER_COLORS.DARK);
    });

    it('should return light log viewer colors', () => {
      const colors = getLogViewerColors('light');
      expect(colors).toEqual(LOG_VIEWER_COLORS.LIGHT);
    });

    it('should return default for unknown mode', () => {
      const colors = getLogViewerColors('unknown' as ThemeMode);
      expect(colors).toEqual(LOG_VIEWER_COLORS.DARK);
    });
  });

  describe('getTheme', () => {
    it('should return theme by id', () => {
      const theme = getTheme('dark');
      expect(theme.id).toBe('dark');
      expect(theme.name).toBe('Dark');
    });

    it('should return default dark theme for unknown id', () => {
      const theme = getTheme('unknown' as ThemeMode);
      expect(theme.id).toBe('dark');
    });
  });

  describe('getAllThemes', () => {
    it('should return all themes', () => {
      const themes = getAllThemes();
      expect(themes).toHaveLength(6);
      expect(themes.map(t => t.id)).toContain('dark');
      expect(themes.map(t => t.id)).toContain('light');
      expect(themes.map(t => t.id)).toContain('monokai');
    });
  });

  describe('getThemeById', () => {
    it('should return theme when exists', () => {
      const theme = getThemeById('dark');
      expect(theme).toBeDefined();
      expect(theme?.id).toBe('dark');
    });

    it('should return undefined for unknown id', () => {
      const theme = getThemeById('unknown' as ThemeMode);
      expect(theme).toBeUndefined();
    });
  });

  describe('isValidTheme', () => {
    it('should return true for valid themes', () => {
      expect(isValidTheme('dark')).toBe(true);
      expect(isValidTheme('light')).toBe(true);
      expect(isValidTheme('monokai')).toBe(true);
    });

    it('should return false for invalid themes', () => {
      expect(isValidTheme('invalid')).toBe(false);
      expect(isValidTheme('')).toBe(false);
    });
  });

  describe('setCssVariables', () => {
    beforeEach(() => {
      vi.stubGlobal('document', {
        documentElement: {
          style: {
            setProperty: vi.fn(),
          },
        },
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should set CSS variables for dark theme', () => {
      const theme = getTheme('dark');
      setCssVariables(theme);
      
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--bg-primary',
        expect.any(String)
      );
    });

    it('should set log viewer CSS variables', () => {
      const theme = getTheme('dark');
      setCssVariables(theme);
      
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--log-bg',
        expect.any(String)
      );
    });
  });
});
