## Why

The `useSearchHistory.ts` hook contains empty catch blocks that silently swallow JSON parse errors. When localStorage data is corrupted or malformed, the error is completely invisible—making it nearly impossible to debug issues related to search history or settings persistence.

## What Changes

- Add error logging to catch blocks in `useSearchHistory.ts`
- Preserve existing fallback behavior (return default values)

## Capabilities

### Modified Capabilities
- `useSearchHistory`: Now logs warnings when localStorage parsing fails instead of failing silently

## Impact

- `frontend/src/hooks/useSearchHistory.ts`: Lines 23, 37 - add error logging to catch blocks