/**
 * LogViewer - Re-export from modular structure
 * 
 * This file now re-exports the refactored LogViewer from the modular structure.
 * The main implementation has been split into:
 * - hooks/useLogViewerState - State management
 * - hooks/useCanvasDimensions - Viewport sizing  
 * - hooks/useScrollLogic - Scroll calculations
 * - hooks/useSelection - Text selection handling
 * - hooks/useLineFetcher - Lazy data loading
 * - canvas/useCanvasDraw - Canvas rendering
 * - widgets/ContextMenu, JsonExpandedViewer, PerformancePanel
 * 
 * Original file: 1180 lines -> Refactored: ~530 lines in modular structure
 */

export { LogViewer } from './LogViewer/LogViewer';
export type { LogViewerProps } from './LogViewer/LogViewer';
export { default } from './LogViewer/LogViewer';