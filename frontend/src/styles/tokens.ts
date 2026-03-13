/**
 * Design Tokens - Consistent styling values
 * 
 * Centralized design tokens for spacing, radius, shadows, and transitions.
 */

export const TOKENS = {
    spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
    },

    radius: {
        sm: '2px',
        md: '4px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
    },

    shadows: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        none: 'none',
    },

    transitions: {
        fast: '150ms ease',
        normal: '200ms ease',
        slow: '300ms ease',
    },

    font: {
        mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },

    fontSize: {
        xs: '10px',
        sm: '12px',
        base: '14px',
        lg: '16px',
        xl: '18px',
        '2xl': '24px',
    },

    lineHeight: {
        tight: 1.75,
        normal: 1.75,
        relaxed: 1.75,
    },

    zIndex: {
        dropdown: 100,
        sticky: 200,
        fixed: 300,
        modalBackdrop: 400,
        modal: 500,
        popover: 600,
        tooltip: 700,
    },
} as const;

export type SpacingKey = keyof typeof TOKENS.spacing;
export type RadiusKey = keyof typeof TOKENS.radius;
export type ShadowKey = keyof typeof TOKENS.shadows;
export type TransitionKey = keyof typeof TOKENS.transitions;
export type FontSizeKey = keyof typeof TOKENS.fontSize;

export function getSpacing(key: SpacingKey): string {
    return TOKENS.spacing[key];
}

export function getRadius(key: RadiusKey): string {
    return TOKENS.radius[key];
}

export function getShadow(key: ShadowKey): string {
    return TOKENS.shadows[key];
}

export function getTransition(key: TransitionKey): string {
    return TOKENS.transitions[key];
}

export function getFontSize(key: FontSizeKey): string {
    return TOKENS.fontSize[key];
}
