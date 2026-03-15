# drag-to-split

## ADDED Requirements

### Requirement: Drag tab to pane edge creates new split

The system SHALL allow users to create a new pane by dragging a tab to the edge of its current pane.

#### Scenario: Drag tab to right edge creates horizontal split

- **GIVEN** a pane with file "app.log" open
- **WHEN** user drags the tab to the right edge (right 25% of pane width)
- **THEN** a split indicator appears on the right edge
- **AND** when the user releases the drag, a new pane is created to the right
- **AND** "app.log" remains in the original pane
- **AND** the new pane shows the empty state (file picker)

#### Scenario: Drag tab to left edge creates horizontal split

- **GIVEN** a pane with file "app.log" open
- **WHEN** user drags the tab to the left edge (left 25% of pane width)
- **THEN** a split indicator appears on the left edge
- **AND** when the user releases the drag, a new pane is created to the left

#### Scenario: Drag tab to bottom edge creates vertical split

- **GIVEN** a pane with file "app.log" open
- **WHEN** user drags the tab to the bottom edge (bottom 25% of pane height)
- **THEN** a split indicator appears on the bottom edge
- **AND** when the user releases the drag, a new pane is created below

#### Scenario: Drag tab to top edge creates vertical split

- **GIVEN** a pane with file "app.log" open
- **WHEN** user drags the tab to the top edge (top 25% of pane height)
- **THEN** a split indicator appears on the top edge
- **AND** when the user releases the drag, a new pane is created above

### Requirement: Drag threshold prevents accidental splits

The system SHALL require a minimum drag distance before activating drag-to-split to distinguish from tab reordering.

#### Scenario: Short drag stays as reordering

- **GIVEN** a pane with tabs ["app.log", "error.log"] in order
- **WHEN** user drags "error.log" less than 20 pixels
- **THEN** no split indicator appears
- **AND** the drag is treated as potential reordering

#### Scenario: Long drag activates split

- **GIVEN** a pane with tabs ["app.log", "error.log"] in order
- **WHEN** user drags "error.log" more than 20 pixels to the right edge
- **THEN** a split indicator appears on the right edge

### Requirement: Split indicator provides visual feedback

The system SHALL show a visual indicator when dragging over a valid split zone.

#### Scenario: Split indicator appears in valid zone

- **GIVEN** a pane with file "app.log" open
- **WHEN** user drags the tab into a valid split zone (edge 25%)
- **THEN** a semi-transparent overlay appears in that zone
- **AND** the overlay color indicates split direction

#### Scenario: Split indicator disappears when leaving zone

- **GIVEN** a pane showing split indicator on right edge
- **WHEN** user drags the tab back to the center
- **THEN** the split indicator disappears

### Requirement: Split creates independent pane

The system SHALL create a new pane that is independent of the original.

#### Scenario: New pane has empty state

- **GIVEN** a pane with file "app.log" open
- **WHEN** user drags the tab to the right edge and releases
- **THEN** a new pane is created to the right
- **AND** the new pane shows the empty state (file picker)
- **AND** the original pane still shows "app.log"

#### Scenario: Each pane maintains independent tabs

- **GIVEN** a pane with files ["app.log", "error.log"] open
- **WHEN** user splits to create a second pane
- **THEN** the original pane still has ["app.log", "error.log"]
- **AND** the new pane has no tabs (empty state)