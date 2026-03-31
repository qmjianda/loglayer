
export interface ThemeColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
  };
  foreground: {
    primary: string;
    secondary: string;
    muted: string;
  };
  border: {
    default: string;
    subtle: string;
  };
  semantic: {
    primary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  input: {
    background: string;
    hover: string;
    active: string;
  };
}

export interface LogViewerColors {
  BACKGROUND: string;
  GUTTER: string;
  GUTTER_TEXT: string;
  GUTTER_SEPARATOR: string;
  HIGHLIGHT_LINE: string;
  HOVER_LINE: string;
  BOOKMARK_BACKGROUND: string;
  BOOKMARK_INDICATOR: string;
  SELECTION: string;
  TEXT: string;
  RULER: string;
  RULER_SEPARATOR: string;
  RULER_VIEWPORT: string;
  SEARCH_HIGHLIGHT: string;
  SEARCH_HIGHLIGHT_ACTIVE: string;
  LAYER_HIGHLIGHT: string;
  WORD_HIGHLIGHT: string;
  CURRENT_LINE: string;
  JUMP_PULSE: string;
  JUMP_PULSE_BORDER: string;
  CONTEXT_MENU: string;
  CONTEXT_MENU_BORDER: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  colors: ThemeColors;
  logViewer: LogViewerColors;
}

export type ThemeId = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'githubDark';

export const themes: Record<ThemeId, ThemeDefinition> = {
  dark: {
    id: 'dark',
    name: 'Dark',
    colors: {
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
      semantic: {
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
    },
    logViewer: {
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
  },
  light: {
    id: 'light',
    name: 'Light',
    colors: {
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
      semantic: {
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
    },
    logViewer: {
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
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai',
    colors: {
      background: {
        primary: '#272822',
        secondary: '#1E1E1E',
        tertiary: '#3E3D32',
        elevated: '#49483E',
      },
      foreground: {
        primary: '#F8F8F2',
        secondary: '#A59F85',
        muted: '#75715E',
      },
      border: {
        default: '#49483E',
        subtle: '#3E3D32',
      },
      semantic: {
        primary: '#A6E22E',
        success: '#A6E22E',
        warning: '#E6DB74',
        error: '#F92672',
        info: '#66D9EF',
      },
      input: {
        background: '#3E3D32',
        hover: '#49483E',
        active: '#49483E',
      },
    },
    logViewer: {
      BACKGROUND: '#272822',
      GUTTER: '#272822',
      GUTTER_TEXT: '#90908A',
      GUTTER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      HIGHLIGHT_LINE: 'rgba(166, 226, 46, 0.15)',
      HOVER_LINE: 'rgba(255, 255, 255, 0.03)',
      BOOKMARK_BACKGROUND: 'rgba(230, 219, 116, 0.1)',
      BOOKMARK_INDICATOR: '#E6DB74',
      SELECTION: 'rgba(249, 38, 114, 0.4)',
      TEXT: '#F8F8F2',
      RULER: '#1E1E1E',
      RULER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      RULER_VIEWPORT: 'rgba(255, 255, 255, 0.08)',
      SEARCH_HIGHLIGHT: '#E6DB74',
      SEARCH_HIGHLIGHT_ACTIVE: '#FF6188',
      LAYER_HIGHLIGHT: '#66D9EF',
      WORD_HIGHLIGHT: 'rgba(102, 217, 239, 0.35)',
      CURRENT_LINE: '#A6E22E',
      JUMP_PULSE: 'rgba(166, 226, 46, 0.3)',
      JUMP_PULSE_BORDER: '#A6E22E',
      CONTEXT_MENU: '#3E3D32',
      CONTEXT_MENU_BORDER: '#49483E',
    },
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      background: {
        primary: '#282A36',
        secondary: '#21222C',
        tertiary: '#343746',
        elevated: '#44475A',
      },
      foreground: {
        primary: '#F8F8F2',
        secondary: '#BDBDBD',
        muted: '#6272A4',
      },
      border: {
        default: '#44475A',
        subtle: '#343746',
      },
      semantic: {
        primary: '#BD93F9',
        success: '#50FA7B',
        warning: '#FFB86C',
        error: '#FF5555',
        info: '#8BE9FD',
      },
      input: {
        background: '#343746',
        hover: '#44475A',
        active: '#44475A',
      },
    },
    logViewer: {
      BACKGROUND: '#282A36',
      GUTTER: '#282A36',
      GUTTER_TEXT: '#6272A4',
      GUTTER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      HIGHLIGHT_LINE: 'rgba(189, 147, 249, 0.15)',
      HOVER_LINE: 'rgba(255, 255, 255, 0.03)',
      BOOKMARK_BACKGROUND: 'rgba(255, 184, 108, 0.1)',
      BOOKMARK_INDICATOR: '#FFB86C',
      SELECTION: 'rgba(255, 85, 85, 0.4)',
      TEXT: '#F8F8F2',
      RULER: '#21222C',
      RULER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      RULER_VIEWPORT: 'rgba(255, 255, 255, 0.08)',
      SEARCH_HIGHLIGHT: '#FFB86C',
      SEARCH_HIGHLIGHT_ACTIVE: '#FF79C6',
      LAYER_HIGHLIGHT: '#BD93F9',
      WORD_HIGHLIGHT: 'rgba(139, 233, 253, 0.35)',
      CURRENT_LINE: '#BD93F9',
      JUMP_PULSE: 'rgba(189, 147, 249, 0.3)',
      JUMP_PULSE_BORDER: '#BD93F9',
      CONTEXT_MENU: '#343746',
      CONTEXT_MENU_BORDER: '#44475A',
    },
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    colors: {
      background: {
        primary: '#2E3440',
        secondary: '#3B4252',
        tertiary: '#434C5E',
        elevated: '#4C566A',
      },
      foreground: {
        primary: '#ECEFF4',
        secondary: '#D8DEE9',
        muted: '#81A1C1',
      },
      border: {
        default: '#4C566A',
        subtle: '#3B4252',
      },
      semantic: {
        primary: '#88C0D0',
        success: '#A3BE8C',
        warning: '#EBCB8B',
        error: '#BF616A',
        info: '#81A1C1',
      },
      input: {
        background: '#3B4252',
        hover: '#434C5E',
        active: '#434C5E',
      },
    },
    logViewer: {
      BACKGROUND: '#2E3440',
      GUTTER: '#2E3440',
      GUTTER_TEXT: '#4C566A',
      GUTTER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      HIGHLIGHT_LINE: 'rgba(136, 192, 208, 0.15)',
      HOVER_LINE: 'rgba(255, 255, 255, 0.03)',
      BOOKMARK_BACKGROUND: 'rgba(235, 203, 139, 0.1)',
      BOOKMARK_INDICATOR: '#EBCB8B',
      SELECTION: 'rgba(191, 97, 106, 0.4)',
      TEXT: '#ECEFF4',
      RULER: '#3B4252',
      RULER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      RULER_VIEWPORT: 'rgba(255, 255, 255, 0.08)',
      SEARCH_HIGHLIGHT: '#EBCB8B',
      SEARCH_HIGHLIGHT_ACTIVE: '#D08770',
      LAYER_HIGHLIGHT: '#88C0D0',
      WORD_HIGHLIGHT: 'rgba(136, 192, 208, 0.35)',
      CURRENT_LINE: '#88C0D0',
      JUMP_PULSE: 'rgba(136, 192, 208, 0.3)',
      JUMP_PULSE_BORDER: '#88C0D0',
      CONTEXT_MENU: '#3B4252',
      CONTEXT_MENU_BORDER: '#4C566A',
    },
  },
  githubDark: {
    id: 'githubDark',
    name: 'GitHub Dark',
    colors: {
      background: {
        primary: '#0D1117',
        secondary: '#161B22',
        tertiary: '#21262D',
        elevated: '#30363D',
      },
      foreground: {
        primary: '#C9D1D9',
        secondary: '#8B949E',
        muted: '#6E7681',
      },
      border: {
        default: '#30363D',
        subtle: '#21262D',
      },
      semantic: {
        primary: '#58A6FF',
        success: '#3FB950',
        warning: '#D29922',
        error: '#F85149',
        info: '#58A6FF',
      },
      input: {
        background: '#21262D',
        hover: '#30363D',
        active: '#30363D',
      },
    },
    logViewer: {
      BACKGROUND: '#0D1117',
      GUTTER: '#0D1117',
      GUTTER_TEXT: '#6E7681',
      GUTTER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      HIGHLIGHT_LINE: 'rgba(88, 166, 255, 0.15)',
      HOVER_LINE: 'rgba(255, 255, 255, 0.03)',
      BOOKMARK_BACKGROUND: 'rgba(210, 153, 34, 0.1)',
      BOOKMARK_INDICATOR: '#D29922',
      SELECTION: 'rgba(248, 81, 73, 0.4)',
      TEXT: '#C9D1D9',
      RULER: '#161B22',
      RULER_SEPARATOR: 'rgba(255, 255, 255, 0.06)',
      RULER_VIEWPORT: 'rgba(255, 255, 255, 0.08)',
      SEARCH_HIGHLIGHT: '#D29922',
      SEARCH_HIGHLIGHT_ACTIVE: '#F0883E',
      LAYER_HIGHLIGHT: '#58A6FF',
      WORD_HIGHLIGHT: 'rgba(88, 166, 255, 0.35)',
      CURRENT_LINE: '#58A6FF',
      JUMP_PULSE: 'rgba(88, 166, 255, 0.3)',
      JUMP_PULSE_BORDER: '#58A6FF',
      CONTEXT_MENU: '#21262D',
      CONTEXT_MENU_BORDER: '#30363D',
    },
  },
};

export function getTheme(id: string): ThemeDefinition | undefined {
  return themes[id as ThemeId];
}

export function getAllThemes(): ThemeDefinition[] {
  return Object.values(themes);
}

export function isValidTheme(id: string): id is ThemeId {
  return id in themes;
}
