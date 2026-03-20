# Keyboard Shortcuts Specification

Unified keyboard shortcut management system with registry, context handling, conflict detection, and cross-platform support.

---

## ADDED Requirements

### Requirement: Centralized shortcut registry

The system SHALL maintain a single source of truth for all keyboard shortcut definitions in `frontend/src/shortcuts/registry.ts`.

The registry SHALL contain:
- Unique shortcut ID (matches CommandPalette command ID)
- Key combinations (array allowing multiple bindings)
- Description (localized string)
- Category (for UI grouping)
- When clause (context condition)
- Priority level

#### Scenario: Registry contains all global shortcuts
- **WHEN** the application initializes
- **THEN** all shortcuts from former `useKeyboardShortcuts.ts`, `useUIState.ts`, `useSearch.ts` SHALL be registered in the central registry

#### Scenario: Registry is type-safe
- **WHEN** a developer adds a new shortcut
- **THEN** TypeScript SHALL enforce all required fields (id, keys, description, category)

#### Scenario: Registry prevents duplicate IDs
- **WHEN** a shortcut with duplicate ID is registered
- **THEN** the system SHALL throw a descriptive error during development

---

### Requirement: Single global keyboard event handler

The system SHALL use exactly one `window.addEventListener('keydown')` handler in `ShortcutProvider`, replacing the current 6+ scattered handlers.

#### Scenario: No duplicate listeners
- **WHEN** the application is running
- **THEN** there SHALL be exactly one keydown listener on the window object for application shortcuts

#### Scenario: Handler cleanup on unmount
- **WHEN** ShortcutProvider unmounts
- **THEN** the global event listener SHALL be removed

---

### Requirement: Context-aware shortcut execution

The system SHALL support a `when` clause system for context-based shortcut activation, inspired by VS Code.

Supported contexts:
- `always`: Shortcut fires regardless of focus
- `notInput`: Shortcut fires unless focus is in input/textarea/contenteditable
- `inputOnly`: Shortcut fires only when focus is in input field
- Custom context keys (extensible)

#### Scenario: Shortcut skips in input field
- **GIVEN** a shortcut with `when: 'notInput'`
- **WHEN** user presses the key combination while focused in a text input
- **THEN** the shortcut SHALL NOT execute

#### Scenario: Shortcut fires outside input field
- **GIVEN** a shortcut with `when: 'notInput'`
- **WHEN** user presses the key combination while focused outside input fields
- **THEN** the shortcut SHALL execute

#### Scenario: Escape closes modal before triggering other handlers
- **GIVEN** a modal is open (e.g., CommandPalette)
- **WHEN** user presses Escape
- **THEN** the modal SHALL close
- **AND** no other Escape handler SHALL fire

---

### Requirement: Cross-platform key normalization

The system SHALL normalize `Cmd` (macOS) and `Ctrl` (Windows/Linux) to a single `Mod` modifier.

#### Scenario: Ctrl on Windows
- **GIVEN** the application runs on Windows/Linux
- **WHEN** user defines shortcut as `Mod+O`
- **THEN** the shortcut SHALL trigger on `Ctrl+O`

#### Scenario: Cmd on macOS
- **GIVEN** the application runs on macOS
- **WHEN** user defines shortcut as `Mod+O`
- **THEN** the shortcut SHALL trigger on `Cmd+O`

#### Scenario: Display shows platform-appropriate keys
- **GIVEN** the application runs on macOS
- **WHEN** KeyboardShortcutsPanel displays shortcuts
- **THEN** it SHALL show `Cmd` instead of `Ctrl`

---

### Requirement: Priority-based conflict resolution

The system SHALL resolve conflicting shortcuts using priority levels.

Priority order (highest wins):
1. `override` - Modal shortcuts (block all others)
2. `high` - Context-sensitive shortcuts (canvas selection)
3. `normal` - Component shortcuts (F3 search, F2 bookmarks)
4. `low` - Global app shortcuts (Ctrl+O, Ctrl+B)

#### Scenario: Higher priority wins
- **GIVEN** two shortcuts use the same key combination
- **AND** one has priority `high`, the other has priority `normal`
- **WHEN** user presses the key combination
- **THEN** only the `high` priority shortcut SHALL execute

#### Scenario: Same priority uses last-registered
- **GIVEN** two shortcuts use the same key combination with same priority
- **WHEN** user presses the key combination
- **THEN** the shortcut registered later SHALL execute

#### Scenario: Override level blocks all lower
- **GIVEN** CommandPalette is open with `override` priority shortcuts
- **WHEN** user presses any key combination registered at lower priority
- **THEN** the lower priority shortcuts SHALL NOT execute

---

### Requirement: useShortcut hook for component registration

The system SHALL provide a `useShortcut` hook for components to register shortcuts declaratively.

#### Scenario: Hook registers shortcut on mount
- **GIVEN** a component uses `useShortcut('find', handler)`
- **WHEN** the component mounts
- **THEN** the shortcut SHALL be registered with the central provider

#### Scenario: Hook unregisters on unmount
- **GIVEN** a component uses `useShortcut('find', handler)`
- **WHEN** the component unmounts
- **THEN** the shortcut SHALL be unregistered from the central provider

#### Scenario: Hook updates when handler changes
- **GIVEN** a component passes a new handler function to useShortcut
- **WHEN** the shortcut is triggered
- **THEN** the new handler SHALL be called

---

### Requirement: Automatic documentation synchronization

The system SHALL provide a `useShortcutDefinitions()` hook that returns all registered shortcuts for UI display.

#### Scenario: KeyboardShortcutsPanel shows live shortcuts
- **GIVEN** KeyboardShortcutsPanel uses `useShortcutDefinitions()`
- **WHEN** a new shortcut is added to the registry
- **THEN** the panel SHALL automatically display the new shortcut

#### Scenario: HelpPanel shows live shortcuts
- **GIVEN** HelpPanel uses `useShortcutDefinitions()`
- **WHEN** a shortcut is removed from the registry
- **THEN** the panel SHALL NOT show the removed shortcut

---

### Requirement: Development-mode conflict warnings

The system SHALL warn developers in console when shortcut conflicts are detected.

#### Scenario: Detect key combination conflict
- **GIVEN** two shortcuts use the same key combination
- **AND** both have the same priority
- **AND** both have overlapping when clauses
- **WHEN** the application runs in development mode
- **THEN** a warning SHALL be logged to console with both shortcut IDs

#### Scenario: No warning for different contexts
- **GIVEN** two shortcuts use the same key combination
- **AND** one has `when: 'notInput'`, the other has `when: 'inputOnly'`
- **WHEN** the application runs
- **THEN** no conflict warning SHALL be logged

---

### Requirement: Capture phase support

The system SHALL support event capture phase for shortcuts that need to intercept before bubbling.

#### Scenario: Capture phase shortcut fires first
- **GIVEN** a shortcut with `phase: 'capture'`
- **AND** another shortcut with `phase: 'bubble'` using the same key
- **WHEN** user presses the key combination
- **THEN** the capture phase shortcut SHALL fire first
- **AND** can prevent the bubble phase shortcut via `e.stopPropagation()`

---

### Requirement: Migration from legacy handlers

The system SHALL provide a migration path from existing scattered handlers without breaking functionality.

#### Scenario: Legacy handlers still work during migration
- **GIVEN** a component still uses `window.addEventListener('keydown')`
- **AND** ShortcutProvider is active
- **WHEN** the component's handler fires
- **THEN** both new and legacy handlers SHALL work
- **AND** no duplicate execution SHALL occur for the same action

#### Scenario: F2 duplicate handler resolved
- **GIVEN** F2 was handled in both useUIState and useBookmarkLogic
- **WHEN** migration is complete
- **THEN** F2 SHALL be handled exactly once in the registry

---

### Requirement: TypeScript type definitions

The system SHALL provide comprehensive TypeScript types for all shortcut-related code.

Types to export:
- `ShortcutDefinition` - Registry entry shape
- `ShortcutId` - Union of all shortcut IDs (autogenerated)
- `ShortcutCategory` - Union of valid categories
- `WhenClause` - Supported context conditions
- `ShortcutPriority` - Priority levels
- `ShortcutHandler` - Handler function signature

#### Scenario: IDE autocomplete for shortcut IDs
- **GIVEN** a developer uses `useShortcut(id, handler)`
- **WHEN** they type the `id` parameter
- **THEN** IDE SHALL show autocomplete for all valid shortcut IDs

#### Scenario: Type error for invalid shortcut ID
- **GIVEN** a developer uses `useShortcut('invalid-id', handler)`
- **WHEN** TypeScript compiles
- **THEN** a type error SHALL be shown for the invalid ID