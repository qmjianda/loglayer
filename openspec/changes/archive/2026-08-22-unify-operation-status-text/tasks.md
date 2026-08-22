## 1. Specification and acceptance tests

- [x] 1.1 Add shared status-message tests for file loading, layer processing, searching, unknown operations, errors, and progress details.
- [x] 1.2 Add component acceptance tests for StatusBar and LoadingOverlays; cover LogViewer loading text where the existing test harness supports it.
- [x] 1.3 Run the focused frontend tests and record the expected red failures before implementation.

## 2. Implementation

- [x] 2.1 Add a typed shared status-message mapping and formatter under `frontend/src/constants/`.
- [x] 2.2 Update StatusBar to use the shared mapping while preserving precedence, progress, pending counts, and errors.
- [x] 2.3 Update LoadingOverlays and LogViewer primary file/index/search status text to use the shared mapping.
- [x] 2.4 EditorFindWidget: while per-tab isSearching is true and results are pending, show 搜索中 instead of 无结果 without error styling (ATDD red first).

## 3. Verification

- [x] 3.1 Run focused tests, TypeScript, lint, formatting check, and frontend build.
- [x] 3.2 Run the relevant backend unit tests to confirm no protocol or backend behavior changed.
- [x] 3.3 Manually verify desktop and narrow layouts: file loading, layer processing, search processing, and completion states; confirm Chinese text is not clipped.
