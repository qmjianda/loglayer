
import { ThemeDefinition } from './definitions';

export function generateCSSVariables(theme: ThemeDefinition): string {
  const { colors, logViewer } = theme;
  
  return `
    --bg-primary: ${colors.background.primary};
    --bg-secondary: ${colors.background.secondary};
    --bg-tertiary: ${colors.background.tertiary};
    --bg-elevated: ${colors.background.elevated};
    
    --fg-primary: ${colors.foreground.primary};
    --fg-secondary: ${colors.foreground.secondary};
    --fg-muted: ${colors.foreground.muted};
    
    --border-default: ${colors.border.default};
    --border-subtle: ${colors.border.subtle};
    
    --color-primary: ${colors.semantic.primary};
    --color-success: ${colors.semantic.success};
    --color-warning: ${colors.semantic.warning};
    --color-error: ${colors.semantic.error};
    --color-info: ${colors.semantic.info};
    
    --input-bg: ${colors.input.background};
    --hover-bg: ${colors.input.hover};
    --active-bg: ${colors.input.active};
    
    --log-bg: ${logViewer.BACKGROUND};
    --log-gutter: ${logViewer.GUTTER};
    --log-text: ${logViewer.TEXT};
    --log-selection: ${logViewer.SELECTION};
    --log-highlight: ${logViewer.HIGHLIGHT_LINE};
    --log-search: ${logViewer.SEARCH_HIGHLIGHT};
    --log-layer: ${logViewer.LAYER_HIGHLIGHT};
    --log-current-line: ${logViewer.CURRENT_LINE};
    --log-bookmark: ${logViewer.BOOKMARK_INDICATOR};
  `.trim();
}

export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement;
  const css = generateCSSVariables(theme);
  
  css.split(';').forEach(rule => {
    const [prop, value] = rule.split(':').map(s => s.trim());
    if (prop && value) {
      root.style.setProperty(prop, value);
    }
  });
}

export function generateFullCSS(theme: ThemeDefinition): string {
  const { colors, logViewer } = theme;
  
  return `
:root {
  --bg-primary: ${colors.background.primary};
  --bg-secondary: ${colors.background.secondary};
  --bg-tertiary: ${colors.background.tertiary};
  --bg-elevated: ${colors.background.elevated};
  
  --fg-primary: ${colors.foreground.primary};
  --fg-secondary: ${colors.foreground.secondary};
  --fg-muted: ${colors.foreground.muted};
  
  --border-default: ${colors.border.default};
  --border-subtle: ${colors.border.subtle};
  
  --color-primary: ${colors.semantic.primary};
  --color-success: ${colors.semantic.success};
  --color-warning: ${colors.semantic.warning};
  --color-error: ${colors.semantic.error};
  --color-info: ${colors.semantic.info};
  
  --input-bg: ${colors.input.background};
  --hover-bg: ${colors.input.hover};
  --active-bg: ${colors.input.active};
  
  --log-bg: ${logViewer.BACKGROUND};
  --log-gutter: ${logViewer.GUTTER};
  --log-text: ${logViewer.TEXT};
  --log-selection: ${logViewer.SELECTION};
  --log-highlight: ${logViewer.HIGHLIGHT_LINE};
  --log-search: ${logViewer.SEARCH_HIGHLIGHT};
  --log-layer: ${logViewer.LAYER_HIGHLIGHT};
  --log-current-line: ${logViewer.CURRENT_LINE};
  --log-bookmark: ${logViewer.BOOKMARK_INDICATOR};
}

.bg-primary { background-color: var(--bg-primary); }
.bg-secondary { background-color: var(--bg-secondary); }
.bg-tertiary { background-color: var(--bg-tertiary); }
.bg-elevated { background-color: var(--bg-elevated); }
.bg-input { background-color: var(--input-bg); }
.bg-hover { background-color: var(--hover-bg); }
.bg-active { background-color: var(--active-bg); }

.text-primary { color: var(--fg-primary); }
.text-secondary { color: var(--fg-secondary); }
.text-muted { color: var(--fg-muted); }

.border-default { border-color: var(--border-default); }
.border-subtle { border-color: var(--border-subtle); }

.text-primary-color { color: var(--color-primary); }
.text-success-color { color: var(--color-success); }
.text-warning-color { color: var(--color-warning); }
.text-error-color { color: var(--color-error); }
.text-info-color { color: var(--color-info); }
  `.trim();
}
