/**
 * shortcuts/index.ts - Barrel export for keyboard shortcut system
 * 
 * Usage:
 * ```typescript
 * import { useShortcut, ShortcutProvider, SHORTCUT_REGISTRY } from '@/shortcuts';
 * ```
 */

// Types
export type {
  ShortcutPriority,
  WhenClause,
  EventPhase,
  ShortcutCategory,
  ShortcutHandler,
  ShortcutHandlerContext,
  ShortcutDefinition,
  ShortcutEntry,
  NormalizedKeyCombo,
  Platform,
  ShortcutProviderProps,
  ShortcutContextValue,
  UseShortcutReturn,
  UseShortcutDefinitionsReturn,
} from './types';

// Context
export { ShortcutContext, useShortcutContext } from './context';

// Provider
export { ShortcutProvider, normalizeKeyCombo } from './ShortcutProvider';

// Registry
export { 
  SHORTCUT_REGISTRY, 
  type ShortcutId, 
  getShortcut, 
  getShortcutsByCategory 
} from './registry';

// Hooks (will be added)
export { useShortcut } from './useShortcut';
export { useShortcutDefinitions } from './useShortcutDefinitions';