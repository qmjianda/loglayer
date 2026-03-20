/**
 * shortcuts/context.ts - React context for keyboard shortcut system
 * 
 * Provides the context definition for the centralized shortcut manager.
 */

import React from 'react';
import type { ShortcutContextValue } from './types';

/**
 * Context for the keyboard shortcut system.
 * 
 * This context provides:
 * - Platform detection for key normalization
 * - Registration/unregistration of shortcut handlers
 * - When-clause evaluation
 * - Access to all registered shortcuts
 * - Override mode for modals
 */
export const ShortcutContext = React.createContext<ShortcutContextValue | null>(null);

/**
 * Hook to access the shortcut context.
 * Throws if used outside of ShortcutProvider.
 */
export function useShortcutContext(): ShortcutContextValue {
  const context = React.useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcutContext must be used within a ShortcutProvider');
  }
  return context;
}