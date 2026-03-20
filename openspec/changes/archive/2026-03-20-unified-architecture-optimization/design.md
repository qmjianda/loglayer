# Design: Unified Architecture Optimization

## Context

### Current State Analysis

**Type System**
- Frontend: `types.ts` (203 lines, 11 core interfaces) mirrors Backend: `schemas.py` (172 lines, 16 Pydantic models)
- Manual synchronization required - documented but not enforced
- 60+ `any` type usages across frontend
- Parameter naming mismatch: `file_id` (Python) vs `fileId` (TypeScript)

**API Layer**
- 42 endpoints defined in `main.py`
- Communication: REST + WebSocket hybrid
- Central client: `bridge_client.ts` (637 lines)
- 3 direct `fetch()` calls bypassing central client

**State Management**
- React hooks: 23 custom hooks
- localStorage: 9 files with direct access
- No unified persistence layer

**Error Handling**
- Python: Generic `except Exception` in 18 locations
- TypeScript: `console.error` with inconsistent formats
- 4 silent failures identified (catch blocks with empty/pass)

### Constraints
- No breaking API changes for existing users
- Must maintain 60fps rendering performance
- Desktop app only (no auth needed)
- Python 3.10+ / React 19 / TypeScript 5.x

### Stakeholders
- **Primary**: AI assistants (need predictable patterns)
- **Secondary**: Human developers (need maintainable code)

---

## Goals / Non-Goals

### Goals
1. **Type Safety**: Eliminate `any` types, create automated type sync validation
2. **API Consistency**: All endpoints follow unified patterns
3. **State Clarity**: Single source of truth for each state category
4. **Error Visibility**: No silent failures, structured error handling
5. **Documentation**: Module design docs for AI understanding

### Non-Goals
- Plugin architecture redesign (deferred)
- Performance optimization (separate initiative)
- Feature additions (this is purely architectural)
- Authentication/authorization (not applicable)

---

## Decisions

### D1: Type Synchronization Strategy

**Decision**: Manual sync with CI validation (not auto-generation)

**Rationale**:
- Auto-generation tools (`pydantic-to-typescript`) add complexity
- Current type count is manageable (~30 types)
- Manual sync allows semantic naming control

**Implementation**:
```
1. Create TYPE_SYNC.md documenting each type pair
2. Add CI step: compare type counts, fail if mismatch
3. Document sync process in AGENTS.md
```

**Alternatives Considered**:
- ❌ Auto-generation: Overkill for current scale, adds build dependency
- ❌ JSON Schema: Requires additional validation layer

---

### D2: API Response Format Standardization

**Decision**: Adopt `{success, data?, error?}` envelope for all endpoints

**Format**:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;      // e.g., 'FILE_NOT_FOUND', 'INVALID_PARAMS'
    message: string;   // Human-readable
    details?: unknown; // Optional debug info
  };
}
```

**Rationale**:
- Consistent error handling on frontend
- Clear success/failure indicator
- Enables unified error boundary

**Migration**:
- Phase 1: New endpoints use new format
- Phase 2: Wrap existing endpoints (non-breaking)
- Phase 3: Update frontend consumers

---

### D3: Centralized Storage Manager

**Decision**: Create `StorageManager` class for all localStorage access

**API**:
```typescript
// frontend/src/utils/StorageManager.ts
class StorageManager {
  // Typed access with defaults
  get<K extends keyof Schema>(key: K): Schema[K];
  set<K extends keyof Schema>(key: K, value: Schema[K]): void;
  
  // Migration support
  migrate(version: number, migrations: MigrationMap): void;
}

// Schema defines all stored values
interface StorageSchema {
  'loglayer.presets': LayerPreset[];
  'loglayer.settings': AppSettings;
  'loglayer.searchHistory': string[];
  // ... all other localStorage keys
}
```

**Rationale**:
- Single point of control for persistence
- Type-safe access prevents typos in keys
- Enables future migration to other storage backends

---

### D4: Error Handling Standardization

**Decision**: Create typed error hierarchy with structured logging

**Python Error Classes**:
```python
# backend/errors.py
class LogLayerError(Exception):
    code: str
    message: str

class FileNotFoundError(LogLayerError):
    code = "FILE_NOT_FOUND"

class InvalidParamsError(LogLayerError):
    code = "INVALID_PARAMS"
```

**TypeScript Error Handler**:
```typescript
// frontend/src/utils/errorHandler.ts
function handleApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  return { code: 'UNKNOWN', message: String(error) };
}
```

**Rationale**:
- Enables structured error responses
- Prevents silent failures (all errors must be handled)
- AI-friendly: error codes are searchable

---

### D5: Parameter Naming Convention

**Decision**: Maintain current convention (Python: snake_case, TypeScript: camelCase)

**Rationale**:
- Each language follows its conventions
- bridge_client.ts already handles transformation
- Changing would be breaking and low-value

**Implementation**:
- Document transformation layer explicitly
- Add helper functions to reduce boilerplate

---

### D6: Code Organization Refactoring

**Decision**: Split large files into focused modules

**LogViewer.tsx (1133 lines) →**:
```
LogViewer/
├── index.tsx           # Main component
├── useCanvas.ts        # Canvas rendering hook
├── useScrollSync.ts    # Scroll synchronization
├── useTextSelection.ts # Text selection handling
└── constants.ts        # Component-specific constants
```

**bridge.py (989 lines) →**:
```
bridge/
├── __init__.py         # FileBridge class
├── file_operations.py  # File open/close/indexing
├── line_reader.py      # read_processed_lines
└── export.py           # Export functionality
```

---

## Risks / Trade-offs

### Risk 1: Breaking Changes in API Response Format
**Mitigation**: Phase migration, maintain backward compatibility layer for 1 version

### Risk 2: Refactoring Large Files May Introduce Bugs
**Mitigation**: 
- Split one file at a time
- Run full test suite after each split
- Keep original files as thin wrappers initially

### Risk 3: StorageManager Migration Complexity
**Mitigation**:
- Start with new keys only
- Migrate existing keys gradually
- Provide migration path for each key

### Risk 4: Type Sync Manual Overhead
**Mitigation**: CI validation catches mismatches immediately

---

## Migration Plan

### Phase 1: Foundation (Week 1)
1. Create `StorageManager` class
2. Create error class hierarchy
3. Create `ApiResponse<T>` type
4. Document current type mappings in `TYPE_SYNC.md`

### Phase 2: API Standardization (Week 2)
1. Update `bridge_client.ts` response handling
2. Add error handling helpers
3. Migrate 3 direct fetch calls to bridge_client

### Phase 3: Code Organization (Week 3)
1. Split `LogViewer.tsx` into sub-components
2. Extract `bridge.py` methods to modules
3. Update imports across codebase

### Phase 4: Documentation (Week 4)
1. Create module design documents
2. Update AGENTS.md with patterns
3. Add TYPE_SYNC.md to CI

### Rollback Strategy
- Each phase is independently deployable
- Feature flags for new error handling
- Git tags at each phase completion

---

## Open Questions

1. **Q: Should we use Zod for runtime type validation on frontend?**
   - Pro: Catches API contract violations
   - Con: Adds bundle size and runtime overhead
   - **Decision**: Defer to Phase 5 evaluation

2. **Q: Should we auto-generate OpenAPI spec from FastAPI?**
   - Pro: Documentation stays in sync
   - Con: Limited value for internal desktop app
   - **Decision**: Add in Phase 4 as documentation tool

3. **Q: How to handle mixed state in App.tsx?**
   - Current: 15+ hooks contributing to 865 lines
   - Options: Context providers, state machine, or keep as-is
   - **Decision**: Evaluate after Phase 3 refactoring