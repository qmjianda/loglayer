## 1. Infrastructure Setup

- [x] 1.1 Create `frontend/src/shortcuts/` directory structure
- [x] 1.2 Create `frontend/src/shortcuts/types.ts` with TypeScript interfaces
- [x] 1.3 Create `frontend/src/shortcuts/context.ts` with React context definition
- [x] 1.4 Create `frontend/src/shortcuts/ShortcutProvider.tsx` with empty provider
- [x] 1.5 Add ShortcutProvider to App.tsx (after SettingsProvider)
- [x] 1.6 Run `npx tsc --noEmit` to verify no type errors

## 2. Registry Implementation

- [x] 2.1 Create `frontend/src/shortcuts/registry.ts` with SHORTCUT_REGISTRY object
- [x] 2.2 Add all current global shortcuts to registry
- [x] 2.3 Implement `normalizeKey()` function for cross-platform Mod → Ctrl/Cmd mapping
- [x] 2.4 Implement `parseKeyCombo()` function to parse "Ctrl+Shift+G" strings
- [x] 2.5 Create `frontend/src/shortcuts/index.ts` barrel export
- [x] 2.6 Run `npx tsc --noEmit` to verify registry types

## 3. Core Hook Implementation

- [x] 3.1 Create `frontend/src/shortcuts/useShortcut.ts` hook skeleton
- [x] 3.2 Implement shortcut registration in useShortcut
- [x] 3.3 Implement shortcut unregistration on unmount
- [x] 3.4 Implement `evaluateWhenClause()` function for context evaluation
- [x] 3.5 Implement priority-based conflict resolution in provider
- [x] 3.6 Add development-mode conflict warning console logs
- [x] 3.7 Write unit tests for shortcuts in test files
- [x] 3.8 Run `npm test` to verify tests pass

## 4. Global Event Handler

- [x] 4.1 Implement single `window.addEventListener('keydown')` in ShortcutProvider
- [x] 4.2 Implement key combination matching logic
- [x] 4.3 Implement handler execution with when-clause filtering
- [x] 4.4 Implement capture phase support
- [x] 4.5 Add platform detection for Mod modifier display
- [x] 4.6 Test all shortcuts work with new handler

## 5. Migrate useKeyboardShortcuts.ts

- [x] 5.1 Update useKeyboardShortcuts.ts to use useShortcut hook
- [x] 5.2 Remove direct `window.addEventListener` from useKeyboardShortcuts.ts
- [x] 5.3 Verify pane management shortcuts still work
- [x] 5.4 Verify settings/command palette shortcuts still work
- [x] 5.5 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 6. Migrate useUIState.ts

- [x] 6.1 Move Ctrl+B, Ctrl+O, Ctrl+Shift+O, Ctrl+H shortcuts to registry
- [x] 6.2 Move Ctrl+Z, Ctrl+Y shortcuts to registry
- [x] 6.3 Move Ctrl+F, Ctrl+G shortcuts to registry
- [x] 6.4 Move F2, Shift+F2 (bookmark navigation) to registry
- [x] 6.5 Move Escape handler to registry
- [x] 6.6 Remove direct `window.addEventListener` from useUIState.ts
- [x] 6.7 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 7. Migrate useSearch.ts

- [x] 7.1 Move F3, Shift+F3 shortcuts to registry
- [x] 7.2 Remove direct `window.addEventListener` from useSearch.ts
- [x] 7.3 Add `when: 'notInput'` to search shortcuts
- [x] 7.4 Verify F3 search navigation works
- [x] 7.5 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 8. Migrate LogViewer.tsx

- [x] 8.1 Move Ctrl+A (select all) to registry with `when: 'viewerFocus'`
- [x] 8.2 Remove direct `window.addEventListener` from LogViewer.tsx
- [x] 8.3 Verify selection shortcuts work in canvas
- [x] 8.4 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 9. Migrate LogViewerPane.tsx

- [x] 9.1 Keep existing capture-phase handler (pane-specific Escape)
- [x] 9.2 Capture-phase Escape handler preserved for pane context
- [x] 9.3 Escape closes Find/GoToLine widgets in pane context
- [x] 9.4 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 10. Update Documentation Display

- [x] 10.1 Create `useShortcutDefinitions()` hook
- [x] 10.2 Update KeyboardShortcutsPanel.tsx to use `useShortcutDefinitions()`
- [x] 10.3 Update HelpPanel.tsx to use `useShortcutDefinitions()`
- [x] 10.4 Verify UI panels show all current shortcuts correctly
- [x] 10.5 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 11. Command Palette Integration

- [x] 11.1 Update AppCommands.tsx to reference registry for shortcut display
- [x] 11.2 Remove duplicate shortcut definitions from AppCommands.tsx
- [x] 11.3 Verify CommandPalette shows correct shortcuts
- [x] 11.4 Run `npx tsc --noEmit` and `npm test` to verify no regressions

## 12. Cleanup

- [x] 12.1 Remove `KEYBOARD_SHORTCUTS` from `frontend/src/constants.ts`
- [x] 12.2 Update `frontend/src/constants.test.ts` to test registry instead
- [x] 12.3 Run full test suite `npm test` to ensure all tests pass
- [x] 12.4 Run `npx tsc --noEmit` to ensure no type errors

## 13. Documentation

- [x] 13.1 Create `docs/guides/SHORTCUT_SYSTEM.md` with architecture overview
- [x] 13.2 Document how to add new shortcuts
- [x] 13.3 Document how to modify existing shortcuts
- [x] 13.4 Document how to remove shortcuts
- [x] 13.5 Update `docs/INDEX.md` to reference new shortcut documentation
- [x] 13.6 AGENTS.md already references shortcut system