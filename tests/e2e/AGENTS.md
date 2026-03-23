# AGENTS.md - E2E Testing Guide

> Playwright E2E tests for LogLayer

---

## Overview

18 test files using Playwright + browser-use AI testing.

---

## Test Structure

### File Organization
```
e2e/
├── fixtures.ts           # Page objects
├── selectors.ts          # UI selectors
├── keyboard-shortcuts.test.ts
├── bookmark-operations.test.ts
├── pane-management.test.ts
└── browser-use/          # AI tests
    ├── scripts/
    └── reports/
```

### Test Pattern
```typescript
import { test, expect } from '@playwright/test';
import { LogLayerPage } from './fixtures';

test('feature description', async ({ page }) => {
  const app = new LogLayerPage(page);
  await app.goto();
  await app.openFile('test.log');
  await expect(page.locator('[data-testid="viewer"]')).toBeVisible();
});
```

---

## Page Objects (fixtures.ts)

```typescript
export class LogLayerPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('http://localhost:5173');
  }
  
  async openFile(filename: string) {
    // Implementation
  }
}
```

---

## Running Tests

```bash
# All E2E tests
npx playwright test e2e/

# Single file
npx playwright test e2e/keyboard-shortcuts.test.ts

# With UI
npx playwright test --ui

# Headed (visible browser)
npx playwright test --headed
```

---

## Selectors

Use data-testid when possible:
```tsx
// Component
<div data-testid="log-viewer">...</div>

// Test
await page.locator('[data-testid="log-viewer"]').click();
```

---

## AI Testing (browser-use)

```bash
# Requires QWEN_URL and QWEN_API_KEY
python tools/run_all_tests.py --browser-use
```

---

## Rules

1. **Use page objects** - No raw selectors in tests
2. **Add data-testid** to interactive elements
3. **Test user flows** - Not implementation details
4. **Screenshots on failure** - Automatic in CI

---

*See root AGENTS.md for full project guidelines*
