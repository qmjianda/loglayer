## Context

`useWorkspaceConfig` currently loads workspace metadata asynchronously. Until that request resolves, `files` is empty and `EditorArea` renders the normal welcome watermark. Once metadata arrives, it sets the file list and starts `openFile` requests, while indexing completion arrives later through the existing per-file signals.

The fix must represent these as two separate phases: workspace restoration and file indexing. It must not use a fixed delay to mask the ordering problem.

## Design

1. Add a typed restore lifecycle state owned by `useWorkspaceConfig`, with at least an idle state and a pending state, plus terminal handling for a successful file-list restore and a no-config/empty result.
2. Set the pending state before workspace persistence reads begin, and settle it on every normal or failed load path. Reset it when the workspace root is cleared or changed.
3. Return the restore state from `useWorkspaceConfig` and pass it through `App.tsx` to `EditorArea`.
4. While restore is pending and no restored panels exist, render a restore-specific loading presentation instead of `WelcomeWatermark`. Reuse the existing loading visual language and avoid introducing a new backend API.
5. Keep calling `openFile` after `setFiles` without awaiting indexing before panels are created. Existing `FileLoadingSkeleton` and `IndexingOverlay` remain responsible for the per-file wait.
6. Preserve the existing active-file selection, path resolution, deduplication, missing-file fallback, layout restoration, and `wasOpen=false` history semantics. Remove only synchronization delays that are not required by a contract; do not add a new arbitrary timeout.
7. Add behavior tests for pending restore, no saved session, restored panels before indexing, and failed-file fallback. The tests must observe state transitions rather than assert a fixed elapsed time.

## Alternatives Considered

- Waiting for all `openFile` calls to finish before rendering: rejected because it conflates workspace restore with indexing and prolongs the blank state.
- Removing backend startup delays or changing indexing concurrency: out of scope until profiling demonstrates that backend startup/indexing is the root cause.
- Showing the normal welcome state with a delayed tab switch: rejected because it preserves the misleading intermediate state.
