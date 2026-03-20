## Context

### Current State
LogLayer's keyboard shortcut system is fragmented across 7+ files with 6+ independent `window.addEventListener('keydown')` handlers:

| File | Handler Count | Shortcuts |
|------|---------------|-----------|
| `hooks/useKeyboardShortcuts.ts` | 1 (global) | Ctrl+Shift+P, Ctrl+Shift+T, Ctrl+,, Ctrl+\, Ctrl+Shift+→/↓, Ctrl+W |
| `hooks/useSearch.ts` | 1 (global) | F3, Shift+F3 |
| `hooks/useUIState.ts` | 1 (global) | Ctrl+Z, Ctrl+Y, Ctrl+F, Ctrl+G, Ctrl+B, Ctrl+O, Ctrl+Shift+O, Ctrl+H, F2, Escape |
| `components/LogViewer.tsx` | 1 (global) | Ctrl+A (select all) |
| `components/LogViewerPane.tsx` | 1 (capture) | Escape (close widgets) |
| `components/CommandPalette.tsx` | 1 (local) | Arrow keys, Enter, Escape |
| `components/BookmarkPopover.tsx` | 1 (local) | Ctrl+Enter |

### Problems
1. **Duplicate Escape handlers** in useUIState, LogViewerPane, and CommandPalette
2. **No conflict detection** - multiple handlers can fire for same key
3. **Documentation drift** - `KeyboardShortcutsPanel.tsx` and `HelpPanel.tsx` contain hardcoded, potentially outdated shortcuts
4. **Unused constants** - `constants.ts` defines 6 shortcuts never consumed
5. **No input filtering** in useSearch.ts (F3 fires even in input fields)
6. **Inconsistent patterns** - some use capture phase, most use bubble

## Goals / Non-Goals

**Goals:**
- Single source of truth for all shortcut definitions
- Centralized event handling with priority/override system
- Context-aware shortcuts (input field exclusion, modal override)
- Automatic documentation sync (registry → UI panels)
- Cross-platform key normalization (Cmd/Ctrl)
- Type-safe shortcut definitions with IDE autocomplete
- Easy add/remove/modify shortcuts for future AI developers

**Non-Goals:**
- User-configurable shortcuts (future consideration)
- Shortcut persistence to settings (out of scope)
- Multi-key chord support (e.g., Ctrl+K Ctrl+C)
- Global OS-level hotkeys (pywebview limitation)

## Decisions

### Decision 1: Build Custom Registry vs Use Library

**Options Considered:**
1. **react-hotkeys-hook** - Popular (1.6M weekly downloads), TypeScript native, scope system
2. **tinykeys** - Lightweight (1KB), modern, framework-agnostic
3. **Custom registry** - Full control, no dependencies

**Decision: Custom registry with tinykeys-inspired API**

**Rationale:**
- LogLayer's needs are specific (canvas focus, pane context, capture phase handling)
- `react-hotkeys-hook` scope system doesn't match our context model
- `tinykeys` is too low-level, lacks React integration
- Custom solution gives full control over priority, context, and integration with existing patterns
- ~150 lines of code vs adding a dependency for features we won't use

### Decision 2: Centralized Provider vs Hook Aggregation

**Decision: `ShortcutProvider` context with `useShortcut` hook**

**Architecture:**
```
App.tsx
  └── SettingsProvider
        └── ShortcutProvider  ← NEW
              └── AppContent
                    ├── useShortcut('find', handler)  // Components register
                    ├── useShortcut('goto', handler)
                    └── ...
```

**Rationale:**
- Single `window.addEventListener` in provider
- Components register shortcuts via hooks, not direct listeners
- Provider handles priority, context, and event routing
- Clean cleanup on unmount

### Decision 3: Shortcut Definition Format

**Decision: Structured registry with metadata**

```typescript
// frontend/src/shortcuts/registry.ts
export const SHORTCUT_REGISTRY = {
  // Navigation
  gotoLine: {
    id: 'goto.line',
    keys: ['Ctrl+G'],
    description: '跳转到行',
    category: 'navigation',
    when: 'notInput',
  },
  // Search
  find: {
    id: 'search.find',
    keys: ['Ctrl+F'],
    description: '查找',
    category: 'search',
    when: 'notInput',
    // Auto-fill selected text
    before: (ctx) => { ctx.setSelectedText(); }
  },
  // ...
} as const satisfies Record<string, ShortcutDefinition>;
```

**Rationale:**
- `id` matches CommandPalette command IDs
- `keys` array allows multiple bindings (Ctrl+\ or Ctrl+Shift+→)
- `when` clause for context filtering
- `category` for UI grouping
- `satisfies` for type inference

### Decision 4: Context Filtering Strategy

**Decision: `when` clause pattern (VS Code-inspired)**

```typescript
type WhenClause = 'always' | 'notInput' | 'inputOnly' | 'viewerFocus' | string;

// Evaluation
const evaluateWhen = (clause: WhenClause, event: KeyboardEvent): boolean => {
  const target = event.target as HTMLElement;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  
  switch (clause) {
    case 'always': return true;
    case 'notInput': return !isInput;
    case 'inputOnly': return isInput;
    case 'viewerFocus': return document.activeElement?.closest('[data-viewer]') !== null;
    default: return true;
  }
};
```

**Rationale:**
- Declarative, easy to understand
- Extensible for future contexts (modal, sidebar, etc.)
- No implicit behavior - all conditions explicit

### Decision 5: Priority and Override System

**Decision: Priority levels with last-registered wins within same level**

```typescript
type ShortcutPriority = 'low' | 'normal' | 'high' | 'override';

// Resolution order:
// 1. Higher priority always wins
// 2. Within same priority, last registered wins
// 3. Override level blocks all lower (for modals)
```

**Use Cases:**
- `low`: Global app shortcuts (Ctrl+O, Ctrl+B)
- `normal`: Component shortcuts (F3 search, F2 bookmarks)
- `high`: Context-sensitive (canvas selection)
- `override`: Modals (CommandPalette, Settings) - block all others

## Risks / Trade-offs

### Risk: Migration complexity
Multiple files need coordinated changes. **Mitigation**: Incremental migration - new system works alongside old handlers, migrate one file at a time.

### Risk: Performance with many shortcuts
Scanning entire registry on every keypress could be slow. **Mitigation**: Build lookup map by key combination on registry init, O(1) lookup.

### Risk: Documentation drift persists
If developers don't update registry. **Mitigation**: Generate UI panels from registry at runtime, no separate hardcoded lists.

### Trade-off: No user configuration
Custom registry makes future user configuration harder than using a library. **Accept**: User configuration is explicitly out of scope; can be added later with settings integration.

### Trade-off: No multi-key chords
System only handles single key combinations. **Accept**: LogLayer doesn't need chords (like VS Code's Ctrl+K Ctrl+C); adding complexity for unused feature.

## Migration Plan

### Phase 1: Infrastructure (No Behavior Change)
1. Create `shortcuts/` module with types, registry, provider
2. Add `ShortcutProvider` to App.tsx (no shortcuts registered yet)
3. Create `useShortcut` hook
4. Write unit tests for registry

### Phase 2: Migrate Global Handlers
1. Move shortcuts from `useKeyboardShortcuts.ts` to registry
2. Update hook to use `useShortcut`
3. Remove standalone `window.addEventListener`
4. Verify all shortcuts still work

### Phase 3: Migrate Component Handlers
1. Migrate `useSearch.ts` F3 handler
2. Migrate `useUIState.ts` handlers
3. Migrate `LogViewer.tsx` handlers
4. Migrate `LogViewerPane.tsx` capture handler

### Phase 4: Documentation Sync
1. Update `KeyboardShortcutsPanel.tsx` to read from registry
2. Update `HelpPanel.tsx` to read from registry
3. Update `constants.ts` or remove `KEYBOARD_SHORTCUTS`
4. Create `docs/guides/SHORTCUT_SYSTEM.md`

### Rollback
Each phase is independently deployable. If issues arise:
1. Remove `ShortcutProvider` from App.tsx
2. Revert individual hook migrations
3. Old handlers still exist in git history

## Open Questions

1. **Capture phase handling**: LogViewerPane uses capture phase for Escape. Should we support both capture and bubble in the new system?
   - **Recommendation**: Yes, add `phase: 'capture' | 'bubble'` to shortcut definition

2. **CommandPalette integration**: Should shortcuts auto-register as commands, or keep separate registries?
   - **Recommendation**: Single source of truth. Shortcuts reference command IDs; CommandPalette reads from shortcut registry for display.

3. **Test coverage**: Current constants.test.ts tests static values. How to test dynamic registry?
   - **Recommendation**: Integration tests with simulated keyboard events; unit tests for when-clause evaluation