/**
 * shortcuts/types.ts - TypeScript type definitions for keyboard shortcut system
 * 
 * Provides type-safe definitions for shortcut registry, handlers, and context.
 */

import type { LayerType } from '../types';

/**
 * Priority levels for shortcut conflict resolution.
 * Higher priority shortcuts take precedence over lower ones.
 * 
 * - `override`: Modal shortcuts (block all lower priority)
 * - `high`: Context-sensitive shortcuts (canvas selection)
 * - `normal`: Component shortcuts (F3 search, F2 bookmarks)
 * - `low`: Global app shortcuts (Ctrl+O, Ctrl+B)
 */
export type ShortcutPriority = 'override' | 'high' | 'normal' | 'low';

/**
 * When clause for context-aware shortcut execution.
 * 
 * - `always`: Shortcut fires regardless of focus
 * - `notInput`: Shortcut fires unless focus is in input/textarea/contenteditable
 * - `inputOnly`: Shortcut fires only when focus is in input field
 * - `viewerFocus`: Shortcut fires when a viewer component has focus
 * - `modalOpen`: Shortcut fires when a modal is open
 */
export type WhenClause = 'always' | 'notInput' | 'inputOnly' | 'viewerFocus' | 'modalOpen';

/**
 * Event phase for keyboard event handling.
 * 
 * - `bubble`: Normal event bubbling (default)
 * - `capture`: Event captured before bubbling (for modals, etc.)
 */
export type EventPhase = 'bubble' | 'capture';

/**
 * Category for UI grouping of shortcuts.
 */
export type ShortcutCategory = 
  | 'navigation'
  | 'search'
  | 'edit'
  | 'commands'
  | 'layers'
  | 'panes'
  | 'bookmarks'
  | 'file'
  | 'view'
  | 'tools';

/**
 * Handler function for a keyboard shortcut.
 * Receives the original keyboard event.
 */
export type ShortcutHandler = (event: KeyboardEvent) => void;

/**
 * Context object passed to shortcut handlers.
 */
export interface ShortcutHandlerContext {
  /** Currently selected text in the canvas */
  selectedText?: string;
  /** Currently highlighted line index */
  highlightedIndex?: number | null;
  /** Active file ID */
  activeFileId?: string | null;
  /** Active pane ID */
  activePaneId?: string | null;
}

/**
 * Definition of a single keyboard shortcut.
 */
export interface ShortcutDefinition {
  /** Unique identifier matching CommandPalette command ID */
  id: string;
  /** Key combinations (allows multiple bindings, e.g., ['Ctrl+\\', 'Ctrl+Shift+→']) */
  keys: string[];
  /** Human-readable description for UI display */
  description: string;
  /** Category for UI grouping */
  category: ShortcutCategory;
  /** Context condition for shortcut activation */
  when?: WhenClause;
  /** Priority for conflict resolution */
  priority?: ShortcutPriority;
  /** Event phase for capture vs bubble */
  phase?: EventPhase;
  /** Whether the shortcut is enabled */
  enabled?: boolean;
}

/**
 * Runtime shortcut entry with handler attached.
 */
export interface ShortcutEntry extends ShortcutDefinition {
  /** The handler function to execute */
  handler: ShortcutHandler;
  /** Registration timestamp for last-registered-wins logic */
  registeredAt: number;
}

/**
 * Normalized key combination for matching.
 */
export interface NormalizedKeyCombo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

/**
 * Platform information for key normalization.
 */
export type Platform = 'mac' | 'windows' | 'linux';

/**
 * Props for ShortcutProvider component.
 */
export interface ShortcutProviderProps {
  children: React.ReactNode;
}

/**
 * Context value for the shortcut system.
 */
export interface ShortcutContextValue {
  /** Platform detected for key normalization */
  platform: Platform;
  /** Register a shortcut handler */
  registerShortcut: (id: string, handler: ShortcutHandler) => void;
  /** Unregister a shortcut handler */
  unregisterShortcut: (id: string) => void;
  /** Check if a when clause is satisfied */
  evaluateWhenClause: (clause: WhenClause | undefined, event: KeyboardEvent) => boolean;
  /** Get all registered shortcuts for display */
  getShortcuts: () => ShortcutDefinition[];
  /** Check if override mode is active (for modals) */
  isOverrideMode: boolean;
  /** Set override mode (for modals like CommandPalette) */
  setOverrideMode: (value: boolean) => void;
}

/**
 * Hook return type for useShortcut.
 */
export type UseShortcutReturn = void;

/**
 * Hook return type for useShortcutDefinitions.
 */
export interface UseShortcutDefinitionsReturn {
  /** All shortcuts grouped by category */
  categories: Map<ShortcutCategory, ShortcutDefinition[]>;
  /** All shortcuts as a flat array */
  shortcuts: ShortcutDefinition[];
  /** Platform for display normalization */
  platform: Platform;
}