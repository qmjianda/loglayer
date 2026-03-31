# AGENTS.md - Hooks Guide

> Custom React hooks for LogLayer

---

## Overview

26 custom hooks for state management. No Redux - pure hooks + prop drilling.

---

## Hook Patterns

### Naming
- `use{Noun}`: `useFileManagement`
- `use{Noun}State`: `useUIState`, `usePaneManagement`
- Test files: `use{Noun}.test.ts`

### File Structure
```
useFeature.ts       # Hook implementation
useFeature.test.ts  # Tests (if complex)
```

### Template
```typescript
import { useState, useCallback } from 'react';

export interface UseFeatureReturn {
  value: string;
  setValue: (v: string) => void;
  reset: () => void;
}

export function useFeature(): UseFeatureReturn {
  const [value, setValue] = useState('');
  
  const reset = useCallback(() => {
    setValue('');
  }, []);
  
  return { value, setValue, reset };
}
```

---

## Key Hooks

| Hook | Purpose | Location |
|------|---------|----------|
| `useFileManagement` | File CRUD (no Pane) | `useFileManagement.ts` |
| `usePaneManagement` | Pane state + split/remove + search | `usePaneManagement.ts` |
| `useLayerManagement` | Layer CRUD + pipeline | `useLayerManagement.ts` |
| `useBridge` | WebSocket + REST bridge | `useBridge.ts` |

## Architecture

```
App.tsx
├── usePaneManagement() → panes, activePaneId, splitPane, removePane
├── useFileManagement() → files, file operations
└── useLayerManagement() → layers for active file
```

**Pane 接口和工具函数**: 从 `usePaneManagement` 导入
```typescript
import { Pane, createPane, findPaneRecursive, updatePaneInTree } from './usePaneManagement';
```

---

## Rules

1. **Always use `useCallback`** for exported functions
2. **Return interface** for complex hooks (document shape)
3. **Handle cleanup** in `useEffect` return
4. **Never export setters directly** - wrap in handlers

---

## Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useFeature } from './useFeature';

test('should reset value', () => {
  const { result } = renderHook(() => useFeature());
  act(() => result.current.setValue('test'));
  act(() => result.current.reset());
  expect(result.current.value).toBe('');
});
```

---

*See root AGENTS.md for full project guidelines*
