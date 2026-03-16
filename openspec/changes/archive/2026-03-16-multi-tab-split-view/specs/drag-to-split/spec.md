# drag-to-split

## ADDED Requirements

### Requirement: Drag tab to pane edge to create split

The system SHALL allow users to create a new pane (split) by dragging a tab to the edge of its current pane.

#### Scenario: Drag to right edge creates vertical split

- **GIVEN** a pane with "app.log" open
- **WHEN** user drags the "app.log" tab to the right edge of the pane (past 25% threshold)
- **THEN** a visual overlay appears indicating a split will be created
- **AND** on release, a new pane is created to the right
- **AND** "app.log" is moved to the new pane
- **AND** both panes now display "app.log" (independent copies)

#### Scenario: Drag to left edge creates vertical split

- **GIVEN** a pane with "app.log" open
- **WHEN** user drags the "app.log" tab to the left edge of the pane
- **THEN** a new pane is created to the left
- **AND** "app.log" is moved to the new pane

#### Scenario: Drag to top edge creates horizontal split

- **GIVEN** a pane with "app.log" open
- **WHEN** user drags the "app.log" tab to the top edge of the pane
- **THEN** a new pane is created above the current pane
- **AND** "app.log" is moved to the new pane

#### Scenario: Drag to bottom edge creates horizontal split

- **GIVEN** a pane with "app.log" open
- **WHEN** user drags the "app.log" tab to the bottom edge of the pane
- **THEN** a new pane is created below the current pane
- **AND** "app.log" is moved to the new pane

### Requirement: Visual feedback during drag-to-split

The system SHALL provide clear visual feedback when a tab is being dragged toward an edge.

#### Scenario: Edge highlight appears on drag

- **GIVEN** a pane with "app.log" open
- **WHEN** user drags the tab past 20px from its original position toward an edge
- **THEN** a semi-transparent overlay appears on that edge
- **AND** the overlay indicates the split direction (left/right/top/bottom)

#### Scenario: No split if released in center

- **GIVEN** a pane with "app.log" open
- **WHEN** user drags the tab but releases it in the center area (not in edge zone)
- **THEN** no new pane is created
- **AND** the tab returns to its original position

### Requirement: New pane shows empty state for original file

The system SHALL handle the file in the original pane after a split.

#### Scenario: Original pane shows empty state

- **GIVEN** a pane with only "app.log" open
- **WHEN** user drags "app.log" to the right edge to split
- **THEN** the new pane shows "app.log" content
- **AND** the original pane shows the empty state (file picker)

### Requirement: Split respects maximum pane limit

The system SHALL not allow creating more than MAX_PANES (4) panes.

#### Scenario: Split blocked at max panes

- **GIVEN** 4 panes already exist (maximum)
- **WHEN** user tries to drag a tab to create a new split
- **THEN** no split is created
- **AND** optionally, a toast/notification indicates the limit is reached