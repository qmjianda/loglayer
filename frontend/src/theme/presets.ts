/**
 * Theme Presets - Professional color schemes
 * 
 * Additional theme options beyond dark/light.
 */

export interface ThemePreset {
    id: string;
    name: string;
    colors: {
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
        color: {
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
    };
    logViewer: {
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
    };
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
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
            color: {
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
            color: {
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
            color: {
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
            color: {
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
        },
    },
};

export type PresetThemeId = keyof typeof THEME_PRESETS;

export function getPresetTheme(id: string): ThemePreset | undefined {
    return THEME_PRESETS[id];
}

export function getAllPresetIds(): string[] {
    return Object.keys(THEME_PRESETS);
}
