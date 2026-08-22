## Why

Issue #8 reports that opening a workspace first shows an empty editor and only later restores files that were open in the previous session. The workspace restore request is asynchronous, but the UI currently presents the normal empty-workspace state during that interval, making a valid restore look like a failure or an unexplained delay.

## What Changes

- Expose an explicit, user-visible workspace-restore-in-progress state while saved workspace metadata is being loaded.
- Make restored file panels appear as soon as the saved file list is available, independently of backend indexing completion.
- Preserve the existing per-file loading/indexing feedback while restored files finish opening.
- Keep the normal empty-workspace welcome state when no saved session exists.
- Do not add arbitrary timeout-based synchronization or change backend indexing behavior without evidence that it is the source of the issue.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-persistence`: Clarify that cross-session restoration must distinguish restore-in-progress from an empty workspace and expose restored files before indexing completes.

## Impact

- Frontend workspace configuration hook and editor-area rendering state.
- Existing workspace persistence APIs remain unchanged.
- Existing file loading/indexing overlays remain the feedback mechanism after restored panels are created.
- Tests covering workspace restore state and the normal empty-workspace path.
