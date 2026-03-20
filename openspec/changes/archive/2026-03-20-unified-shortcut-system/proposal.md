## Why

The current keyboard shortcut system is fragmented across 7+ files with 6+ independent `window.addEventListener('keydown')` handlers, causing maintenance burden, potential conflicts, and inconsistent behavior. There is no central registry, no conflict detection, and display documentation (`KeyboardShortcutsPanel.tsx`, `HelpPanel.tsx`) is disconnected from actual implementations. The `constants.ts` defines only 6 shortcuts that are never used. A unified architecture will enable reliable shortcuts, easier maintenance, and better developer experience.

## What Changes

- **New centralized shortcut registry** with type-safe definitions
- **Single global keyboard event handler** instead of 6+ scattered handlers
- **Context/scope system** for context-aware shortcuts (e.g., different in input fields vs viewer)
- **Cross-platform key normalization** (Cmd on Mac = Ctrl on Windows/Linux)
- **Conflict detection and warning** during development
- **Automatic documentation sync** between registry and UI panels
- **Optional**: Adopt proven open-source library (`react-hotkeys-hook` or `tinykeys`) if suitable
- **BREAKING**: All existing inline shortcut handlers will be removed and replaced with registry-based handlers

## Capabilities

### New Capabilities

- `keyboard-shortcuts`: Centralized keyboard shortcut management system with registry, context handling, conflict detection, and cross-platform support

### Modified Capabilities

None - this is a new capability with no existing spec.

## Impact

### Files to Modify/Remove
- `frontend/src/hooks/useKeyboardShortcuts.ts` - refactor to use new registry
- `frontend/src/hooks/useUIState.ts` - remove inline keyboard handling
- `frontend/src/hooks/useSearch.ts` - remove F3 handler
- `frontend/src/components/LogViewer.tsx` - remove inline keyboard handling
- `frontend/src/components/LogViewerPane.tsx` - remove inline keyboard handling
- `frontend/src/components/KeyboardShortcutsPanel.tsx` - sync with registry
- `frontend/src/components/HelpPanel.tsx` - sync with registry
- `frontend/src/components/AppCommands.tsx` - connect shortcuts to registry
- `frontend/src/constants.ts` - expand KEYBOARD_SHORTCUTS or remove (superseded by registry)

### New Files
- `frontend/src/shortcuts/registry.ts` - central shortcut definitions
- `frontend/src/shortcuts/types.ts` - TypeScript types
- `frontend/src/shortcuts/useShortcut.ts` - hook for registering shortcuts
- `frontend/src/shortcuts/ShortcutProvider.tsx` - context provider
- `docs/guides/SHORTCUT_SYSTEM.md` - documentation for AI and developers

### Dependencies
- May add `react-hotkeys-hook` or `tinykeys` (pending evaluation)
- No backend changes required