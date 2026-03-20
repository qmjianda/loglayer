# Tasks: Unified Architecture Optimization

## 1. Type System Foundation

- [x] 1.1 Create `docs/TYPE_SYNC.md` documenting all type pairs (Python/TypeScript) with file locations and field mappings
- [x] 1.2 Add CI step to compare type counts between `schemas.py` and `types.ts` (fail on mismatch)
- [x] 1.3 Document type sync process in `AGENTS.md` with step-by-step instructions

## 2. TypeScript Type Cleanup

- [x] 2.1 Replace `any` in `bridge_client.ts:292` (syncAll layers param) with `LogLayer[]`
- [x] 2.2 Replace `any` in `bridge_client.ts:300` (syncDecorations layers param) with `LogLayer[]`
- [x] 2.3 Replace `any` in `bridge_client.ts:439` (WorkspaceConfig.files.layers) with `LogLayer[]`
- [ ] 2.4 Fix `any` types in `MainContent.tsx` (14 instances) - create typed props interfaces
- [ ] 2.5 Fix `any` types in `AppModals.tsx` (10 instances) - create typed modal props
- [ ] 2.6 Fix remaining `any` types across 14 other files (28 instances total)

## 3. Error Handling Standardization

- [x] 3.1 Create `backend/errors.py` with `LogLayerError` base class and standard error codes
- [x] 3.2 Create typed error subclasses: `FileNotFoundError`, `InvalidParamsError`, `OperationFailedError`
- [x] 3.3 Create `frontend/src/utils/errorHandler.ts` with `handleApiError()` function
- [ ] 3.4 Update `bridge_client.ts` to use `handleApiError()` in all catch blocks (18 locations)
- [ ] 3.5 Fix silent catch block in `backend/loglayer/layers/builtin/time_filter.py:44-49` (add logging)

## 4. API Response Standardization

- [ ] 4.1 Create `ApiResponse<T>` type in `frontend/src/types.ts`
- [ ] 4.2 Create `ApiResponse` Pydantic model in `backend/loglayer/schemas.py`
- [ ] 4.3 Update 3 direct `fetch()` calls to use `bridge_client.ts`:
  - `frontend/src/hooks/usePluginWidgets.ts`
  - `frontend/src/hooks/useFileWatch.ts`
  - `frontend/src/components/DynamicForm.tsx`
- [ ] 4.4 Add response envelope wrapper in `backend/main.py` for consistent format

## 5. Storage Manager Implementation

- [ ] 5.1 Create `frontend/src/utils/StorageManager.ts` with `StorageSchema` interface
- [ ] 5.2 Implement `get<K extends keyof StorageSchema>(key: K): StorageSchema[K]` method
- [ ] 5.3 Implement `set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K])` method
- [ ] 5.4 Add default values for all storage keys
- [ ] 5.5 Migrate `useSettings.tsx` to use StorageManager
- [ ] 5.6 Migrate `useLayerManagement.ts` preset storage to StorageManager
- [ ] 5.7 Migrate remaining 7 files with direct localStorage to StorageManager

## 6. Code Organization - LogViewer Split

- [ ] 6.1 Create `frontend/src/components/LogViewer/` directory structure
- [ ] 6.2 Extract `useCanvas.ts` hook from LogViewer.tsx (canvas rendering logic)
- [ ] 6.3 Extract `useScrollSync.ts` hook (scroll synchronization logic)
- [ ] 6.4 Extract `useTextSelection.ts` hook (text selection handling)
- [ ] 6.5 Create `LogViewer/constants.ts` with component-specific constants
- [ ] 6.6 Update imports in dependent components
- [ ] 6.7 Verify 60fps performance after refactoring

## 7. Code Organization - Bridge Module Split

- [ ] 7.1 Create `backend/bridge/` package directory
- [ ] 7.2 Extract file operations to `bridge/file_operations.py` (open_file, close_file, indexing)
- [ ] 7.3 Extract line reading to `bridge/line_reader.py` (read_processed_lines)
- [ ] 7.4 Extract export functionality to `bridge/export.py`
- [ ] 7.5 Update imports in `main.py` and other dependents
- [ ] 7.6 Run full test suite to verify no regressions

## 8. Race Condition Fixes

- [ ] 8.1 Fix stale closure in `useSearch.ts:161-196` (add missing dependencies to useCallback)
- [ ] 8.2 Fix async state update race in `useSearch.ts:130-142` (use functional updates)
- [ ] 8.3 Fix memory leak potential in `useVirtualScroll.ts:261-282` (improve interval cleanup)
- [ ] 8.4 Replace dynamic import in `useSearch.ts:172` with static import

## 9. Hardcoded Values Extraction

- [ ] 9.1 Add configurable poll interval to `useFileWatch.ts:77` (currently hardcoded 2000ms)
- [ ] 9.2 Add configurable metrics interval to `useSystemMetrics.ts:23`
- [ ] 9.3 Extract magic numbers from `backend/bridge.py:849,931` (sample sizes 1000, 100) to constants
- [ ] 9.4 Document extracted constants in relevant module docs

## 10. Module Design Documentation

- [ ] 10.1 Create `docs/modules/LogViewer.md` - Canvas rendering, virtual scrolling, event handling
- [ ] 10.2 Create `docs/modules/LayerEngine.md` - Layer pipeline, stage execution, plugin system
- [ ] 10.3 Create `docs/modules/Bridge.md` - Frontend-backend communication, REST/WebSocket patterns
- [ ] 10.4 Create `docs/modules/AppState.md` - State flow, hooks architecture, state ownership
- [ ] 10.5 Update `AGENTS.md` with reference to new module docs
- [ ] 10.6 Create `docs/API.md` with all 42 endpoint documentation

## 11. ADR Updates

- [ ] 11.1 Add TD-014: Type Sync Strategy to `docs/TECHNICAL_DECISIONS.md`
- [ ] 11.2 Add TD-015: API Response Standard to `docs/TECHNICAL_DECISIONS.md`
- [ ] 11.3 Add TD-016: Storage Manager Architecture to `docs/TECHNICAL_DECISIONS.md`

## 12. Verification & Testing

- [ ] 12.1 Run `pytest tests/` - all tests passing
- [ ] 12.2 Run `npx tsc --noEmit` - no type errors
- [ ] 12.3 Verify `any` type count is ≤ 10
- [ ] 12.4 Manual testing: open large log file, verify performance
- [ ] 12.5 Manual testing: error scenarios show proper error messages
- [ ] 12.6 Manual testing: settings persist across app restarts