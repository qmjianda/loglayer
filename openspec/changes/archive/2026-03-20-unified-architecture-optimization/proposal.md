# Unified Architecture Optimization

## Why

LogLayer's codebase has accumulated inconsistencies across 4 years of development that increase bug risk and make AI-assisted development difficult. Analysis reveals: 60+ `any` type usages, 18 inconsistent error handlers, mixed API patterns (GET/POST混用), duplicated state management across 9 files, and missing type synchronization between frontend/backend. These issues directly cause: silent failures, race conditions, and maintenance burden that slows feature development.

This change establishes a unified architecture that reduces bugs through standardization and makes the codebase more predictable for both human developers and AI assistants.

## What Changes

### Type System Unification
- Create automated type synchronization between TypeScript (`types.ts`) and Python (`schemas.py`)
- Replace 60+ `any` types with proper type definitions
- Standardize parameter naming: adopt camelCase across API boundary (or snake_case consistently)
- Extract 14 inline type definitions into named interfaces

### API Layer Standardization
- Consolidate all 42 API endpoints through `bridge_client.ts` (remove 3 direct `fetch()` calls)
- Standardize response format: all endpoints return `{success: boolean, data?: T, error?: {code, message}}`
- Fix GET/POST semantic inconsistencies (queries use GET, mutations use POST)
- Add unified error handling with typed error classes

### State Management Optimization
- Create centralized `StorageManager` for all localStorage operations (currently scattered in 9 files)
- Standardize React state patterns: functional updates, proper dependency arrays
- Document state ownership: UI state (hooks), persistent state (StorageManager), cache state (backend)

### Code Quality Standards
- Replace 18 inconsistent `console.error` with structured logging
- Fix 4 critical race conditions in `useSearch.ts` and `useVirtualScroll.ts`
- Extract hardcoded values to configuration (poll intervals, timeouts, sample sizes)
- Add error recovery mechanisms (currently silent failures)

### Documentation Enhancement
- Add module design documents for core components: LogViewer, LayerEngine, Bridge
- Create architecture decision records for cross-cutting concerns
- Update AGENTS.md with unified patterns reference

## Capabilities

### New Capabilities
- `type-sync-system`: Automated TypeScript/Python type synchronization with CI validation
- `api-error-standard`: Unified error response format and error handling patterns
- `storage-manager`: Centralized persistence layer with type-safe access
- `module-design-docs`: Architecture documentation for AI understanding

### Modified Capabilities
- `error-logging`: Expand existing error logging spec to include structured error types and recovery
- `keyboard-shortcuts`: Align with unified patterns (already partially unified in recent change)

## Impact

### Affected Files
- **Frontend Core**: `types.ts`, `bridge_client.ts`, `App.tsx`, `LogViewer.tsx`
- **Frontend Hooks**: `useSearch.ts`, `useSettings.tsx`, `useVirtualScroll.ts`, `useAppModals.ts`
- **Backend Core**: `main.py`, `bridge.py`, `schemas.py`
- **Documentation**: `AGENTS.md`, `docs/CONTEXT.md`, `docs/PROJECT_MAP.md`

### API Contract Changes
- **BREAKING**: Response format standardization (existing consumers need adaptation)
- Parameter naming remains backward compatible (internal transformation layer)

### Dependencies
- Add `pydantic-to-typescript` or similar for type generation (optional, evaluated in design)
- No new runtime dependencies required

### Non-goals
- Plugin system architecture (separate concern, deferred)
- Authentication/authorization (not needed for desktop app)
- Performance optimization (separate from architecture)
- Feature additions (this is purely architectural)

## User-facing Impact

**No visible feature changes.** Users will experience:
- More stable application (fewer silent failures)
- Faster bug fixes (standardized patterns make debugging easier)
- Better AI assistance for future development

Developers (human and AI) will experience:
- Predictable code patterns across the codebase
- Single source of truth for types and API contracts
- Clear error messages instead of silent failures
- Comprehensive documentation for understanding the architecture