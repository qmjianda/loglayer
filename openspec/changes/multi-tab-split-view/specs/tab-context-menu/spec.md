# tab-context-menu

## ADDED Requirements

### Requirement: Right-click tab shows context menu

The system SHALL display a context menu when users right-click on a tab.

#### Scenario: Right-click shows menu

- **GIVEN** a pane with files ["app.log", "error.log", "access.log"] open
- **WHEN** user right-clicks on the "error.log" tab
- **THEN** a context menu appears with options:
  - "Close" (closes the clicked tab)
  - "Close Others" (closes all tabs except the clicked one)
  - "Close All" (closes all tabs in this pane)
  - "Close Saved" (closes all tabs with no unsaved changes - N/A for log viewer)
  - Divider
  - "Split Right" (creates a split to the right with this file)
  - "Split Down" (creates a split below with this file)

### Requirement: Close from context menu

The context menu SHALL allow closing the clicked tab.

#### Scenario: Close via context menu

- **GIVEN** a pane with files ["app.log", "error.log"] open
- **WHEN** user right-clicks "error.log" and selects "Close"
- **THEN** the "error.log" tab is closed
- **AND** "app.log" remains open and active

### Requirement: Close Others from context menu

The context menu SHALL allow closing all tabs except the clicked one.

#### Scenario: Close Others

- **GIVEN** a pane with files ["app.log", "error.log", "access.log"] open, with "error.log" active
- **WHEN** user right-clicks "error.log" and selects "Close Others"
- **THEN** only "error.log" remains open
- **AND** "error.log" is active

### Requirement: Close All from context menu

The context menu SHALL allow closing all tabs in the pane.

#### Scenario: Close All

- **GIVEN** a pane with files ["app.log", "error.log"] open
- **WHEN** user right-clicks any tab and selects "Close All"
- **THEN** all tabs are closed
- **AND** the pane shows the empty state (file picker)

### Requirement: Split from context menu

The context menu SHALL allow creating a split with the clicked file.

#### Scenario: Split Right from menu

- **GIVEN** a pane with "app.log" open
- **WHEN** user right-clicks the "app.log" tab and selects "Split Right"
- **THEN** a new pane is created to the right
- **AND** "app.log" is moved to the new pane
- **AND** the original pane shows empty state

#### Scenario: Split Down from menu

- **GIVEN** a pane with "app.log" open
- **WHEN** user right-clicks the "app.log" tab and selects "Split Down"
- **THEN** a new pane is created below
- **AND** "app.log" is moved to the new pane
- **AND** the original pane shows empty state

### Requirement: Context menu closes on click outside

The context menu SHALL close when user clicks outside of it.

#### Scenario: Click outside closes menu

- **GIVEN** a context menu is open
- **WHEN** user clicks anywhere outside the menu
- **THEN** the context menu closes

### Requirement: Context menu closes on action

The context menu SHALL close when a menu item is selected.

#### Scenario: Action closes menu

- **GIVEN** a context menu is open
- **WHEN** user selects an option (e.g., "Close")
- **THEN** the action is executed
- **AND** the context menu closes