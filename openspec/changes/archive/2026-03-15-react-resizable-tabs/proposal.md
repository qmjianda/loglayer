## Why

LogLayer currently displays each opened file in a separate pane (EditorGroup), with no tab interface. Users working with multiple log files must manually manage multiple panes via menu or keyboard shortcuts. This lacks the intuitive, browser-like experience users expect from modern desktop applications. Additionally, the current `allotment` library only supports horizontal splits. Adding a multi-tab interface with react-resizable-panels will provide VS Code-style grid layout with draggable/resizable panes.

## What Changes

- **Replace Allotment with react-resizable-panels**: Use the already-installed library for nested H+V splits
- **New TabBar Component**: Chrome-style tab bar at the top of each editor group displaying all open files
- **Tab Interactions**: Click to switch, middle-click or × to close, drag to reorder
- **Drag-to-Split**: Drag tabs to pane edges to create new horizontal/vertical splits
- **Tab Context Menu**: Right-click for Close, Close Others, Close All, Split Right, Split Down
- **Data Structure Update**: Each Pane now contains multiple `openFileIds` instead of single `fileId`

## Capabilities

### New Capabilities
- `multi-tab-interface`: Tab bar with drag-and-drop, reordering, and close functionality
- `drag-to-split`: Drag tabs to pane edges to create new splits using react-resizable-panels
- `tab-context-menu`: Right-click menu for tab operations

### Modified Capabilities
- None. This is a net-new feature that doesn't change existing spec requirements.

## Non-Goals

- **Layout persistence** (save/restore tab arrangement): Deferred to future iteration
- **Tab preview on hover**: Deferred to future iteration
- **Floating tabs** (detached windows): Not in scope for this change
- **Cross-pane tab dragging**: Tabs stay within their parent pane group

## Impact

- **Frontend**: New TabBar component, updates to useFileManagement and usePaneManagement hooks
- **UI**: Replace Allotment with react-resizable-panels for nested split support
- **Dependencies**: No new npm packages required (react-resizable-panels already installed)