## 1. Data Structure Updates

- [x] 1.1 Update Pane interface in useFileManagement.ts - change `fileId: string | null` to `openFileIds: string[]` and add `activeFileId: string | null`
- [x] 1.2 Add migration logic in useFileManagement.ts to convert existing `fileId` to `openFileIds: [fileId]`
- [x] 1.3 Update usePaneManagement.ts to work with new pane structure
- [x] 1.4 Update MainContent.tsx to pass pane.openFileIds to LogViewerPane

## 2. Replace Allotment with react-resizable-panels

- [x] 2.1 Remove allotment import from App.tsx and MainContent.tsx
- [x] 2.2 Import react-resizable-panels (Group, Panel, Separator)
- [x] 2.3 Rewrite MainContent.tsx to use nested Group components
- [x] 2.4 Update pane rendering to work with Panel instead of Allotment.Pane
- [x] 2.5 Verify horizontal and vertical splits work correctly

## 3. TabBar Component

- [x] 3.1 Create TabBar component directory: `components/TabBar/`
- [x] 3.2 Create TabBar.tsx main component with file list display
- [x] 3.3 Create TabItem.tsx for individual tab with close button
- [x] 3.4 Style TabBar to match VS Code dark theme
- [x] 3.5 Add file icon (lucide-react) to each tab

## 4. Tab Interactions

- [x] 4.1 Implement click-to-switch: clicking a tab changes activeFileId
- [x] 4.2 Implement tab close on × button click
- [x] 4.3 Implement tab close on middle-click
- [x] 4.4 Handle empty state when last tab is closed
- [x] 4.5 Add drag-and-drop reordering within tab bar

## 5. Drag-to-Split

- [x] 5.1 Add drag handlers to TabItem
- [x] 5.2 Implement edge detection (left/right/top/bottom 25% zones)
- [x] 5.3 Create SplitIndicator overlay component for visual feedback
- [x] 5.4 Connect drag release to usePaneManagement.splitPane()
- [x] 5.5 Move file to new pane after split
- [x] 5.6 Show empty state in original pane after split
- [x] 5.7 Add drag threshold (20px) to distinguish from tab reordering

## 6. Tab Context Menu

- [x] 6.1 Add right-click handler to TabItem
- [x] 6.2 Create TabContextMenu component using existing ContextMenu
- [x] 6.3 Implement "Close" option
- [x] 6.4 Implement "Close Others" option
- [x] 6.5 Implement "Close All" option
- [x] 6.6 Implement "Split Right" option
- [x] 6.7 Implement "Split Down" option

## 7. Integration & Testing

- [x] 7.1 Replace PaneHeader with TabBar in LogViewerPane
- [x] 7.2 Update App.tsx to work with new pane structure
- [x] 7.3 Run lsp_diagnostics to verify no type errors
- [x] 7.4 Test multi-file opening and tab switching
- [ ] 7.5 Test drag-to-split in all 4 directions
- [ ] 7.6 Test all context menu options
- [ ] 7.7 Verify no regression with existing single-file workflow