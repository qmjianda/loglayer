## Context

### Current State

LogLayer currently uses the `allotment` library to display multiple editor groups (panes). Each pane displays exactly one file at a time:

```typescript
// Current data structure
interface Pane {
  id: string;
  fileId: string | null;  // 1:1 relationship
}

panes: Pane[]  // Each pane = one file
```

### Constraints

1. **Existing Allotment Integration**: The app already uses `allotment` for split views; must integrate with it rather than replace
2. **File Management Hook**: `useFileManagement` manages file state; changes must extend rather than rewrite
3. **Performance**: Must maintain 60FPS for large log files (1M+ lines)
4. **Desktop App**: Must work with pywebview (no floating window support needed yet)

### Stakeholders

- Users who work with multiple log files simultaneously
- Users who need to compare logs side-by-side

---

## Goals / Non-Goals

**Goals:**
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

---

## Decisions

### Decision 1: Embed TabBar Inside Each Pane

**Alternative Considered:**
- **Global TabBar**: Single tab bar across all panes (like VS Code early versions)
- **Per-Pane TabBar**: Each editor group has its own tab bar

**Selected:** Per-Pane TabBar

**Rationale:** This matches VS Code's current behavior and allows each split view to have independent file sets. When users create a new split, they get an empty pane they can populate with different files.

### Decision 2: Data Structure Change - Pane Contains Multiple File IDs

**Alternative Considered:**
- **Global File List**: Keep files as global list, Pane tracks active fileId
- **Pane Contains File Array**: Each pane owns its open files

**Selected:** Pane contains array of file IDs

**Rationale:** This allows:
- Independent tab sets per pane
- Easy drag-between-panes (future)
- Clear ownership - when pane closes, its files close too

**New Structure:**
```typescript
interface Pane {
  id: string;
  openFileIds: string[];      // Multiple files per pane
  activeFileId: string | null; // Currently showing
}
```

### Decision 3: Use Native HTML5 Drag and Drop

**Alternative Considered:**
- **Library**: `dnd-kit` or `react-beautiful-dnd`
- **Native**: HTML5 drag events

**Selected:** Native HTML5 Drag and Drop

**Rationale:**
- Lightweight - no new dependency
- Sufficient for tab reordering and edge detection
- Works well with existing PaneHeader component that already has drag code

### Decision 4: Edge Detection for Drag-to-Split

**Selected:** Divide pane area into 4 zones (left, right, top, bottom)

**Rationale:** Simple to implement - detect which zone the dragged tab hovers over:
- Left 25% → split to left
- Right 25% → split to right  
- Top 25% → split to top
- Bottom 25% → split to bottom
- Center → no action (allow reordering)

**Visual Feedback:** Show semi-transparent overlay indicating split direction when in edge zone.

---

## Risks / Trade-offs

### Risk 1: Allotment Re-render on Tab Change

**Risk:** Switching tabs triggers Allotment re-render, causing flicker

**Mitigation:** Use React.memo on TabBar and LogViewer; only re-render the content area when active file changes

### Risk 2: Drag Events Conflict with Allotment's Resize

**Risk:** Dragging tabs might conflict with Allotment's drag-to-resize

**Mitigation:** Use a drag threshold - only activate drag-to-split after dragging 20px away from tab start position

### Risk 3: Memory Leak with Many Open Files

**Risk:** Users open 10+ files, memory grows unbounded

**Mitigation:** LogLayer already virtualizes large files; tab system doesn't increase memory - each file is loaded once regardless of tabs

---

## Migration Plan

### Phase 1: Data Structure (Day 1)
- Update `Pane` interface in `useFileManagement.ts`
- Add migration: convert existing `fileId` to `openFileIds: [fileId]`

### Phase 2: TabBar Component (Day 2)
- Create `components/TabBar/` directory
- Implement TabBar, TabItem components
- Style to match VS Code dark theme

### Phase 3: Tab Interactions (Day 3)
- Click to switch tabs
- Middle-click / × to close
- Drag to reorder

### Phase 4: Drag-to-Split (Day 4)
- Add edge detection zones
- Visual feedback overlay
- Connect to `usePaneManagement.splitPane()`

### Phase 5: Cleanup (Day 5)
- Remove old PaneHeader component (replaced by TabBar)
- Test edge cases
- Verify no regression

---

## Open Questions

1. **Q: Should we keep the "empty pane" state or always require at least one tab?**
   - Current: Pane can have no file (shows empty state)
   - Alternative: Always show last closed tab's files
   - **Decision:** Keep current - empty pane shows file picker

2. **Q: How to handle files opened while a pane has no tabs?**
   - Add to current pane's tab list
   - If no active pane, create new pane

3. **Q: Keyboard shortcuts - should Ctrl+1/2/3 switch panes or tabs?**
   - VS Code: Ctrl+1/2/3 switches editor groups (panes)
   - **Decision:** Follow VS Code - tabs use Ctrl+Tab/PageUp/PageDown