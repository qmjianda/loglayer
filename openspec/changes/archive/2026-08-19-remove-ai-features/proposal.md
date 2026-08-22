## Why

AI functionality was added before its product requirements and support model were clear. Removing it now eliminates unused provider/configuration surface and avoids shipping misleading AI controls while keeping the core log-analysis workflow focused and supportable.

## What Changes

- **BREAKING** Remove the backend `ai` package, provider implementations, singleton service, router registration, and all `/api/ai/*` endpoints.
- **BREAKING** Remove AI chat/settings UI, right-click AI actions, AI hooks, commands, views, and time-range AI buttons.
- Remove AI-only package dependencies, environment/API-key injection, startup/configuration references, and current documentation claims.
- Preserve ordinary log opening, search, filtering, highlighting, bookmarking, copy actions, and non-AI TIME_RANGE fields and behavior.
- Keep the existing `ai-assistant-features` change as historical context; it is not completed by this change.

## Capabilities

### New Capabilities

- `ai-feature-removal`: Defines the absence of AI backend/frontend/API/configuration surface and preservation of ordinary log analysis.

### Modified Capabilities

None.

## Impact

Affected areas include `backend/ai`, `backend/main.py`, frontend layout/settings/editor/context-menu/time-range components and hooks, `package.json`/lockfile, `vite.config.ts`, current project documentation, and focused removal acceptance tests. Existing non-AI REST/WebSocket APIs, timestamp parsing, time-range configuration fields, and log analysis tests remain in scope.
