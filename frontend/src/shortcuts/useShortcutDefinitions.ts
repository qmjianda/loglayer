/**
 * shortcuts/useShortcutDefinitions.ts - Hook for getting all shortcut definitions
 * 
 * Use this hook to get all registered shortcuts for UI display.
 * Automatically reflects changes when shortcuts are added/removed.
 * 
 * @example
 * ```typescript
 * const { shortcuts, categories, platform } = useShortcutDefinitions();
 * 
 * // Display shortcuts grouped by category
 * categories.forEach((shortcuts, category) => {
 *   console.log(category, shortcuts);
 * });
 * ```
 */

import { useMemo } from 'react';
import { useShortcutContext } from './context';
import { SHORTCUT_REGISTRY, getShortcutsByCategory } from './registry';
import type { ShortcutDefinition, ShortcutCategory, UseShortcutDefinitionsReturn } from './types';

/**
 * Hook to get all shortcut definitions for UI display.
 * 
 * Returns:
 * - `shortcuts`: All shortcuts as a flat array
 * - `categories`: Shortcuts grouped by category (Map)
 * - `platform`: Current platform for display normalization (Mac vs Windows)
 */
export function useShortcutDefinitions(): UseShortcutDefinitionsReturn {
  const context = useShortcutContext();

  const result = useMemo(() => {
    // Get from registry directly (static definitions)
    const shortcuts = Object.values(SHORTCUT_REGISTRY) as ShortcutDefinition[];
    const categories = getShortcutsByCategory();

    return {
      shortcuts,
      categories,
      platform: context.platform,
    };
  }, [context.platform]);

  return result;
}