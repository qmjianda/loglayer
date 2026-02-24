## 1. SQL-like Query

- [x] 1.1 Create SQL query parser utility (`utils/sqlParser.ts`)
- [x] 1.2 Implement parseSQLQuery function (supports =, AND, OR, NOT, CONTAINS)
- [x] 1.3 Add syntax detection (SQL vs regex auto-detection)
- [x] 1.4 Integrate with SearchPanel input
- [x] 1.5 Add error display for invalid SQL syntax

## 2. File Watch (Real-time)

- [x] 2.1 Add file watch state to useUIState hook
- [x] 2.2 Create watch toggle button in toolbar
- [x] 2.3 Implement polling mechanism (backend API for file modification time)
- [x] 2.4 Add auto-scroll behavior when new content arrives
- [ ] 2.5 Add "New content available" indicator when user scrolls up
- [x] 2.6 Add watching indicator to StatusBar

## 3. JSON Tree View

- [x] 3.1 Create JSON detection utility function
- [x] 3.2 Create JsonTreeView component (expandable/collapsible)
- [x] 3.3 Add syntax highlighting for JSON values
- [ ] 3.4 Integrate with LogViewer (detect and render JSON lines)
- [ ] 3.5 Add right-click context menu for expand/collapse all

## 4. Log Statistics Panel

- [x] 4.1 Create StatsPanel component
- [x] 4.2 Implement log level counting (ERROR, WARN, INFO, DEBUG, TRACE)
- [x] 4.3 Add color-coded bar visualization
- [x] 4.4 Add Stats button to toolbar
- [x] 4.5 Make statistics update on filter changes

## 5. Integration & Polish

- [x] 5.1 Add keyboard shortcuts for new features
- [x] 5.2 Test all features work together
- [x] 5.3 Run TypeScript and pytest verification
- [ ] 5.4 Update documentation
