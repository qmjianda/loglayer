# AGENTS.md - LogLayer AI Guide

> AI coding assistant guidelines for the LogLayer project

---

## Project Overview

**LogLayer** - High-performance log analysis desktop application
- **Backend**: Python 3.10+ FastAPI with Pydantic
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Desktop**: pywebview for cross-platform native window

---

## Build / Lint / Test Commands

### Unified Test Structure
```
tests/
├── unit/           # Python backend unit tests
├── integration/    # Python backend integration tests
├── e2e/            # Playwright E2E tests
├── vitest/         # Frontend Vitest tests
├── benchmarks/     # Performance tests
└── repro/          # Bug reproduction tests
```

### Frontend (TypeScript/React)
```bash
# Development
npm run dev                    # Start Vite dev server

# Build
npm run build                  # Type check + Vite build
npx tsc --noEmit              # Type check only (fast)

# Testing (Vitest)
npm run test                   # Run all Vitest tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage report

# E2E Testing (Playwright)
npm run test:e2e               # Run E2E tests
npm run test:e2e:ui            # Interactive mode
npm run test:e2e:headed        # Visible browser
npx playwright show-report     # View test report

# Linting
npx eslint .                   # ESLint check
```

### Backend (Python)
```bash
# Run server
python backend/main.py
python backend/main.py --no-ui  # Headless mode

# Testing (pytest)
pytest tests/unit/ -v          # Run unit tests
pytest tests/integration/ -v   # Run integration tests
pytest tests/unit/test_layer_core.py -v   # Single test file
pytest tests/unit/test_layer_core.py::TestLayerStage::test_stage_values -v  # Single test

# Linting
ruff check .                   # Python linting
ruff check --fix .             # Auto-fix issues
mypy backend/                  # Type checking

# Unified test runner
python tools/run_all_tests.py              # Run all tests
python tools/run_all_tests.py --e2e        # Include E2E
python tools/run_all_tests.py --browser-use # Include AI tests
```

---

## Code Style Guidelines

### TypeScript (Frontend)

**Imports**
- Group imports: React → External libs → Internal modules
- Use named imports for React: `import React from 'react'`
- **Use relative paths** (NOT `@/` alias): `'./components/Sidebar'`

```typescript
// Good
import React from 'react';
import { useState, useCallback } from 'react';
import { Icon } from './components/common/Icon';  // Relative path

// Avoid
import * as React from 'react';  // Don't use namespace import
import { Icon } from '@/components/common/Icon';  // Don't use @/ alias
```

**Naming**
- Components: PascalCase (`EmptyState.tsx`)
- Hooks: camelCase with `use` prefix (`useFileManagement.ts`)
- Types/Interfaces: PascalCase (`interface EmptyStateProps`)
- Variables/functions: camelCase (`onOpen`, `fileId`)
- Constants: UPPER_SNAKE_CASE (`DARK_THEME`, `LOG_VIEWER_COLORS`)

**Types**
- Prefer `interface` over `type` for object shapes
- Use explicit return types for exported functions
- **NEVER use `as any`** or `@ts-ignore` (strict policy)
- Mirror Python types with `// Mirror: backend/loglayer/schemas.py::TypeName`

**Components**
- Use functional components with hooks
- Props interface named `{ComponentName}Props`
- Event handlers named `on{Event}` (e.g., `onClick`, `onFileActivate`)

```typescript
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ onClick, disabled }) => {
  return <button onClick={onClick} disabled={disabled} />;
};
```

### Python (Backend)

**Imports**
- Standard library → Third-party → First-party
- Sort with `ruff` (isort configured)

```python
# Good
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel

from loglayer.core import Layer
```

**Naming**
- Variables/functions: snake_case (`file_id`, `line_index`)
- Classes: PascalCase (`LayerRegistryEntry`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- Enums: PascalCase with values as UPPER (`LayerType.FILTER`)

**Types**
- Use Pydantic `BaseModel` for data classes
- Use `Optional[]` for nullable types
- Add type hints for function signatures

**Error Handling**
- Use FastAPI HTTPException for API errors
- Log errors with context before raising

---

## Theme Architecture (CSS Variables)

**Unified theme system** - Use CSS variables, never hardcode colors.

```css
/* Available CSS Variables */
--bg-primary, --bg-secondary, --bg-tertiary, --bg-elevated
--fg-primary, --fg-secondary, --fg-muted
--border-default, --border-subtle
--color-primary, --color-success, --color-warning, --color-error
```

**Utility Classes** (in `index.css`)
```
.bg-primary, .bg-secondary, .bg-tertiary, .bg-elevated
.text-primary, .text-secondary, .text-muted
.border-default, .border-subtle
.text-primary-color, .bg-primary-color
```

**Usage in Components**
```tsx
// ✅ Good - Theme-aware
<div className="bg-secondary text-primary border-default">

// ❌ Bad - Hardcoded, breaks theme switching
<div className="bg-white text-black">
<div className="bg-blue-500/10 text-blue-400">
<div className="text-white">  // White text on colored bg
```

**Theme Colors**
- Dark theme (default): bg `#0d0d0d` / fg `#e5e5e5`
- Light theme: bg `#f8fafc` / fg `#0f172a`

---

## Type Sync (Frontend ↔ Backend)

When adding new types:
1. Add Pydantic model in `backend/loglayer/schemas.py`
2. Add TypeScript interface in `frontend/src/types.ts`
3. Add mirror comment: `// Mirror: backend/loglayer/schemas.py::TypeName`
4. Update `docs/TYPE_SYNC.md`

**Naming conversion**:
- Python `snake_case` → TypeScript `camelCase`
- `bridge_client.ts` handles automatic conversion

---

## Testing Guidelines

**After code changes, always run:**
- Frontend: `npx tsc --noEmit`
- Backend: `pytest tests/ -v`
- UI changes: E2E tests with `npx playwright test e2e/`

**Test patterns:**
- Python: `pytest` with class-based organization
- TypeScript: `vitest` with `@testing-library/react`
- E2E: `playwright` with page objects in `e2e/fixtures.ts`

---

## Documentation References

| Topic | File |
|-------|------|
| Architecture | `docs/PROJECT_MAP.md` |
| Tech Stack | `docs/CONTEXT.md` |
| Type Sync | `docs/TYPE_SYNC.md` |
| UI Layout | `docs/UI/README.md` |
| Layer Development | `docs/guides/LAYER_DEV_GUIDE.md` |

---

*Last updated: 2026-03-22*
