## Context

The `useSearchHistory.ts` hook reads settings and search history from localStorage. When JSON.parse() fails on corrupted data, the empty catch blocks silently swallow the error.

## Goals / Non-Goals

**Goals:**
- Add error logging to catch blocks for debugging
- Preserve existing fallback behavior

**Non-Goals:**
- Change error handling strategy (still return defaults)
- Add retry logic or data recovery

## Decisions

### Decision 1: Use console.warn

Using `console.warn` is appropriate because:
- It's visible in development tools but not as intrusive as console.error
- It doesn't break the application flow
- It provides sufficient context for debugging localStorage issues