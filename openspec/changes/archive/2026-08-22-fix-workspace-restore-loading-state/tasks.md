## 1. Specification and acceptance tests

- [x] 1.1 Add a frontend restore-state test that distinguishes pending restore from the normal empty-workspace state.
- [x] 1.2 Add a test that restored file panels are available before `openFile`/indexing completion.
- [x] 1.3 Add a test that no saved session retains the normal welcome state.
- [x] 1.4 Add or extend a regression test for missing restored files falling back to history without stuck loading.

## 2. Implementation

- [x] 2.1 Add typed workspace restore lifecycle state to `useWorkspaceConfig` and settle it on all load paths.
- [x] 2.2 Thread restore state through `App.tsx` into `EditorArea`.
- [x] 2.3 Render an explicit restore-in-progress state and preserve existing per-file loading/indexing overlays.
- [x] 2.4 Remove only unnecessary restore synchronization delays; do not synchronize restoration on indexing completion.

## 3. Verification

- [x] 3.1 Run targeted frontend tests and confirm the issue regression scenarios pass.
- [x] 3.2 Run TypeScript diagnostics, lint, formatting checks, and the relevant build/tests.
- [x] 3.3 Verify the OpenSpec change against the implementation and confirm no unrelated worktree changes were modified.
