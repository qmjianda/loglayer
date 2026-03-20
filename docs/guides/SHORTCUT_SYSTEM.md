# Keyboard Shortcut System

LogLayer uses a centralized keyboard shortcut system defined in `frontend/src/shortcuts/`.

## Architecture

```
frontend/src/shortcuts/
├── index.ts                    # Barrel exports
├── types.ts                    # TypeScript interfaces
├── context.ts                  # React context
├── registry.ts                 # Central shortcut definitions
├── ShortcutProvider.tsx        # Global event handler
├── useShortcut.ts              # Hook for registering shortcuts
└── useShortcutDefinitions.ts   # Hook for UI display
```

## How It Works

1. **Single Global Handler**: `ShortcutProvider` maintains one `window.addEventListener('keydown')` for all shortcuts
2. **Registry-Based**: All shortcuts are defined in `SHORTCUT_REGISTRY` in `registry.ts`
3. **Priority Resolution**: Conflicts are resolved using priority levels (`override` > `high` > `normal` > `low`)
4. **Context Filtering**: `when` clauses control when shortcuts fire (e.g., `notInput` skips in text fields)

## Adding a New Shortcut

1. **Add to registry** in `frontend/src/shortcuts/registry.ts`:

```typescript
myNewShortcut: {
  id: 'my.newShortcut',
  keys: ['Ctrl+Shift+M'],
  description: 'My new shortcut',
  category: 'commands' as ShortcutCategory,
  when: 'notInput' as const,
  priority: 'normal' as const,
},
```

2. **Register handler** in your component:

```typescript
import { useShortcut } from '../shortcuts';

useShortcut('myNewShortcut', useCallback(() => {
  // Your handler logic
}, [dependencies]));
```

3. **Update UI** - `KeyboardShortcutsPanel` and `HelpPanel` automatically show the new shortcut.

## Modifying a Shortcut

1. Edit the `keys` array in `registry.ts`
2. UI panels update automatically

```typescript
find: {
  keys: ['Ctrl+F', 'Cmd+F'],  // Multiple bindings
  // ...
},
```

## Removing a Shortcut

1. Remove from `SHORTCUT_REGISTRY`
2. Remove `useShortcut` call from component
3. UI panels update automatically

## Key Combination Format

- Modifiers: `Ctrl`, `Shift`, `Alt`, `Meta`
- Special keys: `Enter`, `Escape`, `F1`-`F12`, `ArrowUp`, `ArrowDown`, etc.
- Multiple bindings: `keys: ['Ctrl+\\', 'Ctrl+Shift+ArrowRight']`

## When Clauses

| Clause | Behavior |
|--------|----------|
| `always` | Fires regardless of focus |
| `notInput` | Skips in input/textarea/contenteditable |
| `inputOnly` | Only fires in input fields |
| `viewerFocus` | Only fires when viewer has focus |

## Priority Levels

| Priority | Use Case |
|----------|----------|
| `override` | Modal shortcuts (block all lower) |
| `high` | Context-sensitive (canvas selection) |
| `normal` | Component shortcuts (F3, F2) |
| `low` | Global app shortcuts (Ctrl+O) |

## Cross-Platform

The system normalizes `Ctrl` (Windows/Linux) and `Cmd` (macOS). UI panels show platform-appropriate keys.