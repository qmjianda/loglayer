# AGENTS.md - Components Guide

> React component conventions for LogLayer

---

## Overview

35+ React 19 components using CSS theme variables. Strict **no hardcoded colors** policy.

---

## Component Patterns

### File Structure
```
ComponentName.tsx      # Main component
ComponentName.test.tsx # Vitest tests (optional)
index.ts               # Re-exports (for folders)
```

### Template
```typescript
import React from 'react';

interface ComponentNameProps {
  onEvent: () => void;
  optional?: string;
}

export const ComponentName: React.FC<ComponentNameProps> = ({ onEvent, optional }) => {
  return <div className="bg-secondary text-primary">{optional}</div>;
};
```

---

## Theme Rules (CRITICAL)

### ❌ FORBIDDEN
```tsx
<div className="bg-white text-black">
<div className="text-white">              {/* On colored bg */}
<div className="bg-blue-500/10 text-blue-400">
```

### ✅ REQUIRED
```tsx
<div className="bg-secondary text-primary border-default">
<button className="bg-primary-color text-primary">
```

### Available Classes
| Class | Variable | Usage |
|-------|----------|-------|
| `bg-primary` | `--bg-primary` | Main background |
| `bg-secondary` | `--bg-secondary` | Cards, panels |
| `text-primary` | `--fg-primary` | Primary text |
| `text-muted` | `--fg-muted` | Secondary text |
| `text-primary-color` | `--color-primary` | Brand color |
| `border-default` | `--border-default` | Borders |

---

## Props Conventions

- Interface name: `ComponentNameProps`
- Event handlers: `on{Event}` (`onClick`, `onFileActivate`)
- Boolean flags: `is{State}` (`isVisible`, `isLoading`)
- Optional props: `?` modifier

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `text-white` | `text-primary` |
| `bg-white/10` | `bg-secondary` or `bg-tertiary` |
| `hover:bg-white/10` | `hover:bg-theme-hover` |
| Hardcoded colors | CSS variable classes |

---

*See root AGENTS.md for full project guidelines*
