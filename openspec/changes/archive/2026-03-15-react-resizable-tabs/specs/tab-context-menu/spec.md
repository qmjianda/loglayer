# tab-context-menu

## ADDED Requirements

### Requirement: Right-click on tab shows context menu

The system SHALL display a context menu when users right-click on a tab.

#### Scenario: Right-click shows context menu

- **GIVEN** a pane with files ["app.log", "error.log"] open, with "app.log" active
- **WHEN** user right-clicks on the "error.log" tab
- **THEN** a context menu appears with options: Close, Close Others, Close All, Split Right, Split Down

### Requirement: Close option closes the clicked tab

The context menu SHALL include a "Close" option that closes the currently clicked tab.

#### Scenario: Close from context menu

- **GIVEN** a pane with files ["app.log", "error.log"] open
- **WHEN** user right-clicks on "error.log" and selects "Close"
- **THEN** the "error.log" tab is closed
- **AND** "app.log" remains open and active

### Requirement: Close Others option closes all tabs except clicked

The context menu SHALL include a "Close Others" option that closes all tabs except the clicked one.

#### Scenario: Close Others

- **GIVEN** a pane with files ["app.log", "error.log", "access.log"] open
- **WHEN** user right-clicks on "error.log" and selects "Close Others"
- **THEN** "error.log" remains open
- **AND** "app.log" and "access.log" are closed

### Requirement: Close All option closes all tabs in pane

The context menu SHALL include a "Close All" option that closes all tabs in the pane.

#### Scenario: Close All

- **GIVEN** a pane with files ["app.log", "error.log", "access.log"] open
- **WHEN** user right-clicks on any tab and selects "Close All"
- **THEN** all tabs are closed
- **AND** the pane shows the empty state (file picker)

### Requirement: Split Right creates new pane to the right

The context menu SHALL include a "Split Right" option that creates a new pane to the right of the current pane.

#### Scenario: Split Right from context menu

- **GIVEN** a pane with file "app.log" open
- **WHEN** user right-clicks on the tab and selects "Split Right"
- **THEN** a new pane is created to the right
- **AND** "app.log" remains in the original pane
- **AND** the new pane shows the empty state (file picker)

### Requirement: Split Down creates new pane below

The context menu SHALL include a "Split Down" option that creates a new pane below the current pane.

#### Scenario: Split Down from context menu

- **GIVEN** a pane with file "app.log" open
- **WHEN** user right-clicks on the tab and selects "Split Down"
- **THEN** a new pane is created below the original
- **AND** "app.log" remains in the original pane
- **AND** the new pane shows the empty state (file picker)

### Requirement: Context menu closes when clicking outside

The context menu SHALL close when the user clicks outside of it.

#### Scenario: Click outside closes menu

- **GIVEN** a context menu is open on a tab
- **WHEN** user clicks anywhere outside the menu
- **THEN** the context menu closes