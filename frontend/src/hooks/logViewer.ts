/**
 * LogViewer Hooks Integration
 * 
 * Central export for all LogViewer-related hooks.
 * This module provides a unified interface for LogViewer component to use.
 */

export { useCanvasRender } from './useCanvasRender';
export type { UseCanvasRenderOptions, UseCanvasRenderReturn, RenderConfig } from './useCanvasRender';

export { useSelection } from './useSelection';
export type { Selection, NormalizedSelection, UseSelectionOptions, UseSelectionReturn } from './useSelection';

export { useContextMenu } from './useContextMenu';
export type { ContextMenuState, UseContextMenuOptions, UseContextMenuReturn } from './useContextMenu';

export { useVirtualScroll } from './useVirtualScroll';
export type { 
    PerformanceMetrics, 
    UseVirtualScrollOptions, 
    UseVirtualScrollReturn 
} from './useVirtualScroll';

export { canvasRenderer } from '../utils/CanvasRenderer';
export type { 
    RenderLineOptions, 
    RenderGutterOptions, 
    RenderBackgroundOptions,
    LogViewerColors 
} from '../utils/CanvasRenderer';