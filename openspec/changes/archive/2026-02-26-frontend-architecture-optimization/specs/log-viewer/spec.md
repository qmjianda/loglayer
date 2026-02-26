## MODIFIED Requirements

### Requirement: LogViewer Rendering Pipeline
The system SHALL render log lines using Canvas with high performance virtualization.

#### Scenario: Initial file load
- **WHEN** user opens a log file with 1M+ lines
- **THEN** only visible lines + buffer are rendered (typically <1000 lines)
- **AND** scroll position maps correctly to logical line numbers
- **AND** FPS remains above 30 during scrolling

#### Scenario: Horizontal scroll
- **WHEN** user scrolls horizontally
- **THEN** content shifts left/right smoothly
- **AND** line numbers remain visible in gutter

#### Scenario: Selection highlight
- **WHEN** user selects text with mouse
- **THEN** selected region is highlighted with selection color
- **AND** selection persists until user clicks elsewhere

#### Scenario: Right-click context menu
- **WHEN** user right-clicks on log content
- **THEN** context menu appears at cursor position
- **AND** menu options include: Copy, Send to AI, Highlight, Filter, Toggle Bookmark, Copy Line

#### Scenario: Performance stats display
- **WHEN** user clicks Perf button
- **THEN** overlay shows FPS, visible line count, memory usage
- **AND** updates every second

### Requirement: LogViewer Architecture Refactoring
The system SHALL refactor LogViewer into separated concerns.

#### Scenario: Render logic isolated
- **WHEN** canvas renders content
- **THEN** rendering logic is in pure functions (CanvasRenderer.ts)
- **AND** no React component state directly in render path

#### Scenario: Selection logic separated
- **WHEN** user makes selection
- **THEN** selection logic is handled by useSelection hook
- **AND** selection normalization happens separately from rendering

#### Scenario: Context menu logic separated
- **WHEN** context menu opens
- **THEN** menu state managed by useContextMenu hook
- **AND** component only handles rendering

#### Scenario: Virtual scroll logic separated
- **WHEN** user scrolls
- **THEN** scroll calculations handled by virtual scroll logic
- **AND** visible range calculation is decoupled from rendering
