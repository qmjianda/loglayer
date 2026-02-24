## 1. SQL-like Query

- [ ] 1.1 Create SQL query parser utility (`utils/sqlParser.ts`)
- [ ] 1.2 Implement parseSQLQuery function (supports =, AND, OR, NOT, CONTAINS)
- [ ] 1.3 Add syntax detection (SQL vs regex auto-detection)
- [ ] 1.4 Integrate with SearchPanel input
- [ ] 1.5 Add error display for invalid SQL syntax

## 2. File Watch (Real-time)

- [ ] 2.1 Add file watch state to useUIState hook
- [ ] 2.2 Create watch toggle button in toolbar
- [ ] 2.3 Implement polling mechanism (backend API for file modification time)
- [ ] 2.4 Add auto-scroll behavior when new content arrives
- [ ] 2.5 Add "New content available" indicator when user scrolls up
- [ ] 2.6 Add watching indicator to StatusBar

## 3. JSON Tree View

- [ ] 3.1 Create JSON detection utility function
- [ ] 3.2 Create JsonTreeView component (expandable/collapsible)
- [ ] 3.3 Add syntax highlighting for JSON values
- [ ] 3.4 Integrate with LogViewer (detect and render JSON lines)
- [ ] 3.5 Add right-click context menu for expand/collapse all

## 4. Log Statistics Panel

- [ ] 4.1 Create StatsPanel component
- [ ] 4.2 Implement log level counting (ERROR, WARN, INFO, DEBUG, TRACE)
- [ ] 4.3 Add color-coded bar visualization
- [ ] 4.4 Add Stats button to toolbar
- [ ] 4.5 Make statistics update on filter changes

## 5. Integration & Polish

- [ ] 5.1 Add keyboard shortcuts for new features
- [ ] 5.2 Test all features work together
- [ ] 5.3 Run TypeScript and pytest verification
- [ ] 5.4 Update documentation
