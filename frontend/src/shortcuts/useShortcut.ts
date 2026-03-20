/**
 * shortcuts/useShortcut.ts - Hook for registering keyboard shortcuts
 * 
 * Use this hook to register a handler for a defined shortcut.
 * The handler will be automatically unregistered when the component unmounts.
 * 
 * @example
 * ```typescript
 * useShortcut('find', (e) => {
 *   e.preventDefault();
 *   setIsFindVisible(true);
 * });
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { useShortcutContext } from './context';
import type { ShortcutId } from './registry';

/**
 * Hook to register a keyboard shortcut handler.
 * 
 * @param id - The shortcut ID from SHORTCUT_REGISTRY
 * @param handler - The handler function to execute when the shortcut is triggered
 * @param deps - Optional dependency array for handler memoization
 */
export function useShortcut(
  id: ShortcutId,
  handler: (event: KeyboardEvent) => void,
  deps: React.DependencyList = []
): void {
  const context = useShortcutContext();
  
  // Use ref to always have the latest handler
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Stable handler that calls the ref
  const stableHandler = useCallback((event: KeyboardEvent) => {
    handlerRef.current(event);
  }, []);

  // Register/unregister on mount/unmount
  useEffect(() => {
    context.registerShortcut(id, stableHandler);
    
    return () => {
      context.unregisterShortcut(id);
    };
  }, [context, id, stableHandler]);

  // Update handler when deps change
  useEffect(() => {
    handlerRef.current = handler;
  }, deps);
}