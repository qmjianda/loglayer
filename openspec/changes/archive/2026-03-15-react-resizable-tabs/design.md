## Context

### Current State

LogLayer currently uses the `allotment` library to display multiple editor groups (panes). Each pane displays exactly one file at a time:

```typescript
// Current data structure
interface Pane {
  id: string;
  fileId: string | null;  // 1:1 relationship
}

panes: Pane[]  // Each pane = one file, horizontal split only
```

The current `allotment` implementation only supports horizontal splits, not the nested H+V grid that VS Code provides.

### Constraints

1. **Existing react-resizable-panels**: Already installed in package.json but unused
2. **File Management Hook**: `useFileManagement` manages file state; changes must extend rather than rewrite
3. **Performance**: Must maintain 60FPS for large log files (1M+ lines)
4. **Desktop App**: Must work with pywebview (no floating window support needed yet)

### Stakeholders

- Users who work with multiple log files simultaneously
- Users who need to compare logs side-by-side in a grid layout

---

## Goals / Non-Goals

**Goals:**
- Replace allotment with react-resizable-panels for nested H+V splits
- Add tab bar UI to each editor group (pane)
- Support drag-and-drop for tab reordering within a group
- Support drag-to-split by dragging tabs to pane edges
- Support closing tabs (middle-click or × button)
- Support keyboard shortcuts (Ctrl+Tab, Ctrl+W, etc.)

**Non-Goals:**
- Layout persistence (save/restore on app restart)
- Tab preview on hover
- Floating/detached windows
- Cross-group tab dragging (tabs stay within their group)
- Cross-pane tab dragging

---

## Decisions

### Decision 1: Use react-resizable-panels Instead of Allotment

**Alternative Considered:**
- **allotment**: Current library, horizontal splits only
- **react-resizable-panels**: Already installed, supports nested H+V grid

**Selected:** react-resizable-panels

**Rationale:**
- Already in package.json (no new dependency)
- Supports nested Group components for H+V grid layout
- Built-in resize handles, collapsible panels
- Better for VS Code-style editor layouts

### Decision 2: Per-Pane TabBar

**Alternative Considered:**
- **Global TabBar**: Single tab bar across all panes (like VS Code early versions)
- **Per-Pane TabBar**: Each editor group has its own tab bar

**Selected:** Per-Pane TabBar

**Rationale:** This matches VS Code's current behavior and allows each split view to have independent file sets.

### Decision 3: Data Structure - Pane Contains Multiple File IDs

**Alternative Considered:**
- **Global File List**: Keep files as global list, Pane tracks active fileId
- **Pane Contains File Array**: Each pane owns its open files

**Selected:** Pane contains array of file IDs

**Rationale:**
- Independent tab sets per pane
- Easy to manage - when pane closes, its tabs close too
- Clear ownership

**New Structure:**
```typescript
interface Pane {
  id: string;
  openFileIds: string[];      // Multiple files per pane
  activeFileId: string | null; // Currently showing
}
```

### Decision 4: Use Native HTML5 Drag and Drop for Tabs

**Alternative Considered:**
- **Library**: `dnd-kit` or `react-beautiful-dnd`
- **Native**: HTML5 drag events

**Selected:** Native HTML5 Drag and Drop

**Rationale:**
- Lightweight - no new dependency
- Sufficient for tab reordering and edge detection

### Decision 5: Edge Detection for Drag-to-Split

**Selected:** Divide pane area into 4 zones (left, right, top, bottom)

**Rationale:** Simple to implement:
- Left 25% → split to left
- Right 25% → split to right
- Top 25% → split to top
- Bottom 25% → split to bottom
- Center → no action (allow reordering)

**Visual Feedback:** Show semi-transparent overlay indicating split direction when in edge zone.

---

## Risks / Trade-offs

### Risk 1: react-resizable-panels Re-render on Tab Change

**Risk:** Switching tabs triggers Panel re-render, causing flicker

**Mitigation:** Use React.memo on TabBar and LogViewer; only re-render the content area when active file changes

### Risk 2: Drag Events Conflict with Resize Handles

**Risk:** Dragging tabs might conflict with react-resizable-panels' drag-to-resize

**Mitigation:** Use a drag threshold - only activate drag-to-split after dragging 20px away from tab start position

### Risk 3: Memory Leak with Many Open Files

**Risk:** Users open 10+ files, memory grows unbounded

**Mitigation:** LogLayer already virtualizes large files; tab system doesn't increase memory - each file is loaded once regardless of tabs

### Risk 4: Migration from Allotment

**Risk:** Breaking change - existing users' split layout changes

**Mitigation:** The new layout is more powerful (nested splits), users will benefit. Migration is one-time.

---

## Migration Plan

### Phase 1: Data Structure (Day 1)
- Update `Pane` interface in `useFileManagement.ts`
- Add migration: convert existing `fileId` to `openFileIds: [fileId]`

### Phase 2: Replace Allotment with react-resizable-panels (Day 2)
- Update MainContent.tsx to use nested Group components
- Remove allotment imports and usage

### Phase 3: TabBar Component (Day 3)
- Create `components/TabBar/` directory
- Implement TabBar, TabItem components
- Style to match VS Code dark theme

### Phase 4: Tab Interactions (Day 4)
- Click to switch tabs
- Middle-click / × to close
- Drag to reorder

### Phase 5: Drag-to-Split (Day 5)
- Add edge detection zones
- Visual feedback overlay
- Connect to `usePaneManagement.splitPane()`

### Phase 6: Tab Context Menu (Day 6)
- Right-click menu with all options

---

## Open Questions

1. **Q: Should we keep the "empty pane" state or always require at least one tab?**
   - Current: Pane can have no file (shows empty state)
   - **Decision:** Keep current - empty pane shows file picker

2. **Q: How to handle files opened while a pane has no tabs?**
   - Add to current pane's tab list
   - If no active pane, create new pane

3. **Q: Keyboard shortcuts - should Ctrl+1/2/3 switch panes or tabs?**
   - VS Code: Ctrl+1/2/3 switches editor groups (panes)
   - **Decision:** Follow VS Code - tabs use Ctrl+Tab/PageUp/PageDown