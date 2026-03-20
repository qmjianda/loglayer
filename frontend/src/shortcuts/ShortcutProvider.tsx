/**
 * shortcuts/ShortcutProvider.tsx - Central keyboard shortcut manager
 * 
 * Provides a single global keyboard event handler and manages
 * shortcut registration, conflict resolution, and context evaluation.
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { 
  ShortcutProviderProps, 
  ShortcutContextValue, 
  Platform, 
  WhenClause,
  ShortcutEntry,
  NormalizedKeyCombo,
  ShortcutDefinition
} from './types';
import { ShortcutContext } from './context';
import { SHORTCUT_REGISTRY } from './registry';

/**
 * Detect the current platform for key normalization.
 */
function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'windows';
  
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  return 'linux';
}

/**
 * Normalize a key combination string to a comparable object.
 * Handles platform-specific modifiers (Mod → Ctrl/Cmd).
 */
export function normalizeKeyCombo(keyCombo: string, platform: Platform): NormalizedKeyCombo {
  const parts = keyCombo.toLowerCase().split(/[+\s]+/);
  
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let key = '';

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        ctrl = true;
        break;
      case 'alt':
        alt = true;
        break;
      case 'shift':
        shift = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        meta = true;
        break;
      case 'mod':
        // Mod is Ctrl on Windows/Linux, Cmd on Mac
        if (platform === 'mac') {
          meta = true;
        } else {
          ctrl = true;
        }
        break;
      default:
        key = part;
    }
  }

  return { ctrl, alt, shift, meta, key };
}

/**
 * Check if a keyboard event matches a normalized key combination.
 */
function eventMatchesCombo(event: KeyboardEvent, combo: NormalizedKeyCombo): boolean {
  const eventKey = event.key.toLowerCase();
  
  // Handle special keys
  const keyMap: Record<string, string> = {
    'arrowup': 'arrowup',
    'arrowdown': 'arrowdown',
    'arrowleft': 'arrowleft',
    'arrowright': 'arrowright',
    'enter': 'enter',
    'escape': 'escape',
    'backspace': 'backspace',
    'tab': 'tab',
    'space': ' ',
    'delete': 'delete',
  };

  const normalizedEventKey = keyMap[eventKey] || eventKey;
  const normalizedComboKey = keyMap[combo.key] || combo.key;

  return (
    event.ctrlKey === combo.ctrl &&
    event.altKey === combo.alt &&
    event.shiftKey === combo.shift &&
    event.metaKey === combo.meta &&
    normalizedEventKey === normalizedComboKey
  );
}

/**
 * Evaluate a when clause against the current context.
 */
function evaluateWhenClauseInternal(
  clause: WhenClause | undefined, 
  event: KeyboardEvent
): boolean {
  if (!clause || clause === 'always') return true;

  const target = event.target as HTMLElement;
  const isInput = 
    target.tagName === 'INPUT' || 
    target.tagName === 'TEXTAREA' || 
    target.isContentEditable;

  const isViewerFocus = 
    document.activeElement?.closest('[data-viewer]') !== null;

  switch (clause) {
    case 'notInput':
      return !isInput;
    case 'inputOnly':
      return isInput;
    case 'viewerFocus':
      return isViewerFocus;
    case 'modalOpen':
      // This is set by modals via setOverrideMode
      return true;
    default:
      return true;
  }
}

/**
 * Priority weight for conflict resolution.
 */
function getPriorityWeight(priority: string | undefined): number {
  switch (priority) {
    case 'override': return 4;
    case 'high': return 3;
    case 'normal': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

/**
 * ShortcutProvider - Central keyboard shortcut manager.
 * 
 * This component:
 * - Maintains a single window.addEventListener for all shortcuts
 * - Manages shortcut registration from components
 * - Handles priority-based conflict resolution
 * - Evaluates when-clauses for context-aware execution
 */
export const ShortcutProvider: React.FC<ShortcutProviderProps> = ({ children }) => {
  const platform = useMemo(() => detectPlatform(), []);
  const handlersRef = useRef<Map<string, ShortcutEntry>>(new Map());
  const [isOverrideMode, setIsOverrideMode] = useState(false);

  // Build lookup map from registry on mount
  const registryMap = useMemo(() => {
    const map = new Map<string, ShortcutDefinition>();
    for (const [key, def] of Object.entries(SHORTCUT_REGISTRY)) {
      map.set(def.id, def as ShortcutDefinition);
    }
    return map;
  }, []);

  /**
   * Register a shortcut handler.
   */
  const registerShortcut = useCallback((id: string, handler: (event: KeyboardEvent) => void) => {
    const definition = registryMap.get(id);
    if (!definition) {
      console.warn(`[ShortcutProvider] Unknown shortcut ID: ${id}`);
      return;
    }

    const entry: ShortcutEntry = {
      ...definition,
      handler,
      registeredAt: Date.now(),
    };

    handlersRef.current.set(id, entry);
  }, [registryMap]);

  /**
   * Unregister a shortcut handler.
   */
  const unregisterShortcut = useCallback((id: string) => {
    handlersRef.current.delete(id);
  }, []);

  /**
   * Evaluate a when clause.
   */
  const evaluateWhenClause = useCallback(
    (clause: WhenClause | undefined, event: KeyboardEvent): boolean => {
      return evaluateWhenClauseInternal(clause, event);
    },
    []
  );

  /**
   * Get all registered shortcuts for display.
   */
  const getShortcuts = useCallback((): ShortcutDefinition[] => {
    return Array.from(handlersRef.current.values());
  }, []);

  /**
   * Global keyboard event handler.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // DEBUG: Log all keydown events
      console.log('[ShortcutProvider] keydown:', event.key, 'ctrl:', event.ctrlKey, 'shift:', event.shiftKey, 'alt:', event.altKey, 'meta:', event.metaKey);
      console.log('[ShortcutProvider] registered handlers:', handlersRef.current.size, Array.from(handlersRef.current.keys()));

      // Collect all matching shortcuts
      const matches: ShortcutEntry[] = [];

      for (const entry of handlersRef.current.values()) {
        // Skip disabled shortcuts
        if (entry.enabled === false) continue;

        // Check each key combination
        for (const keyCombo of entry.keys) {
          const normalized = normalizeKeyCombo(keyCombo, platform);
          const matchesCombo = eventMatchesCombo(event, normalized);
          console.log('[ShortcutProvider] checking', entry.id, keyCombo, 'normalized:', normalized, 'matches:', matchesCombo);
          if (matchesCombo) {
            matches.push(entry);
            break;
          }
        }
      }

      if (matches.length === 0) return;

      // Sort by priority (highest first), then by registration time (newest first)
      matches.sort((a, b) => {
        const weightDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
        if (weightDiff !== 0) return weightDiff;
        return b.registeredAt - a.registeredAt;
      });

      // Check if override mode is active
      if (isOverrideMode) {
        // Only allow override priority shortcuts
        const overrideMatch = matches.find(m => m.priority === 'override');
        if (overrideMatch) {
          event.preventDefault();
          overrideMatch.handler(event);
        }
        return;
      }

      // Get the highest priority match
      const winner = matches[0];
      const winnerPriority = getPriorityWeight(winner.priority);

      // Filter to only same-priority entries for when-clause evaluation
      const samePriority = matches.filter(
        m => getPriorityWeight(m.priority) === winnerPriority
      );

      // Find first that passes when-clause
      for (const match of samePriority) {
        if (evaluateWhenClauseInternal(match.when, event)) {
          event.preventDefault();
          match.handler(event);
          break;
        }
      }

      // Development mode conflict warning
      if (process.env.NODE_ENV === 'development' && samePriority.length > 1) {
        const passing = samePriority.filter(m => evaluateWhenClauseInternal(m.when, event));
        if (passing.length > 1) {
          console.warn(
            `[ShortcutProvider] Multiple shortcuts with same priority matched:`,
            passing.map(p => p.id)
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [platform, isOverrideMode]);

  const contextValue: ShortcutContextValue = useMemo(
    () => ({
      platform,
      registerShortcut,
      unregisterShortcut,
      evaluateWhenClause,
      getShortcuts,
      isOverrideMode,
      setOverrideMode: setIsOverrideMode,
    }),
    [
      platform,
      registerShortcut,
      unregisterShortcut,
      evaluateWhenClause,
      getShortcuts,
      isOverrideMode,
    ]
  );

  return (
    <ShortcutContext.Provider value={contextValue}>
      {children}
    </ShortcutContext.Provider>
  );
};