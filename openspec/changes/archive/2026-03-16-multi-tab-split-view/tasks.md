## 1. Data Structure Updates

- [ ] 1.1 Update Pane interface in useFileManagement.ts - change `fileId: string | null` to `openFileIds: string[]` and add `activeFileId: string | null`
- [ ] 1.2 Add migration logic in useFileManagement.ts to convert existing `fileId` to `openFileIds: [fileId]`
- [ ] 1.3 Update usePaneManagement.ts to work with new pane structure
- [ ] 1.4 Update MainContent.tsx to pass pane.openFileIds to LogViewerPane

## 2. TabBar Component

- [ ] 2.1 Create TabBar component directory: `components/TabBar/`
- [ ] 2.2 Create TabBar.tsx main component with file list display
- [ ] 2.3 Create TabItem.tsx for individual tab with close button
- [ ] 2.4 Style TabBar to match VS Code dark theme
- [ ] 2.5 Add file icon (lucide-react) to each tab

## 3. Tab Interactions

- [ ] 3.1 Implement click-to-switch: clicking a tab changes activeFileId
- [ ] 3.2 Implement tab close on × button click
- [ ] 3.3 Implement tab close on middle-click
- [ ] 3.4 Handle empty state when last tab is closed
- [ ] 3.5 Add drag-and-drop reordering within tab bar

## 4. Drag-to-Split

- [ ] 4.1 Add drag handlers to TabItem
- [ ] 4.2 Implement edge detection (left/right/top/bottom 25% zones)
- [ ] 4.3 Create SplitIndicator overlay component for visual feedback
- [ ] 4.4 Connect drag release to usePaneManagement.splitPane()
- [ ] 4.5 Move file to new pane after split
- [ ] 4.6 Show empty state in original pane after split
- [ ] 4.7 Add drag threshold (20px) to distinguish from tab reordering

## 5. Tab Context Menu

- [ ] 5.1 Add right-click handler to TabItem
- [ ] 5.2 Create TabContextMenu component using existing ContextMenu
- [ ] 5.3 Implement "Close" option
- [ ] 5.4 Implement "Close Others" option
- [ ] 5.5 Implement "Close All" option
- [ ] 5.6 Implement "Split Right" option
- [ ] 5.7 Implement "Split Down" option

## 6. Integration & Testing

- [ ] 6.1 Replace PaneHeader with TabBar in LogViewerPane
- [ ] 6.2 Update App.tsx to work with new pane structure
- [ ] 6.3 Run lsp_diagnostics to verify no type errors
- [ ] 6.4 Test multi-file opening and tab switching
- [ ] 6.5 Test drag-to-split in all 4 directions
- [ ] 6.6 Test all context menu options
- [ ] 6.7 Verify no regression with existing single-file workflow