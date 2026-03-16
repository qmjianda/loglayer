## Why

LogLayer currently displays each opened file in a separate pane (EditorGroup), with no tab interface. Users working with multiple log files (e.g., comparing error.log with access.log) must manually manage multiple panes via menu or keyboard shortcuts. This lacks the intuitive, browser-like experience users expect from modern desktop applications. Adding a multi-tab interface with drag-to-split will dramatically improve workflow efficiency.

## What Changes

- **New TabBar Component**: Chrome-style tab bar at the top of each editor group displaying all open files
- **Drag-to-Split**: Drag tabs to edges to create horizontal/vertical splits
- **Tab Reordering**: Drag tabs to reorder within the same group
- **Tab Close**: Middle-click or click × to close tabs
- **Data Structure Update**: Each Pane now contains multiple `openFileIds` instead of single `fileId`
- **Tab Context Menu**: Right-click for additional options (Close, Close Others, Close All)

## Capabilities

### New Capabilities

- `multi-tab-interface`: Tab bar with drag-and-drop, reordering, and close functionality
- `drag-to-split`: Drag tabs to pane edges to create new splits
- `tab-context-menu`: Right-click menu for tab operations

### Modified Capabilities

- None. This is a net-new feature that doesn't change existing spec requirements.

## Non-Goals

- **Layout persistence** (save/restore tab arrangement): Deferred to future iteration
- **Tab preview on hover**: Deferred to future iteration
- **Floating tabs** (detached windows): Not in scope for this change

## Impact

- **Frontend**: New TabBar component, updates to useFileManagement and usePaneManagement hooks
- **UI**: Changed pane structure from 1:1 (pane:file) to 1:N (pane:multiple files)
- **Dependencies**: No new npm packages required; using existing allotment library