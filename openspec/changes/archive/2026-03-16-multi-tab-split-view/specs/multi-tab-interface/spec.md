# multi-tab-interface

## ADDED Requirements

### Requirement: Tab Bar displays open files per pane

The system SHALL display a tab bar at the top of each editor group (pane) showing all currently open files in that pane. Each tab SHALL display the file name and a close button.

#### Scenario: Single file open

- **GIVEN** a pane with one file "app.log" open
- **WHEN** the pane is rendered
- **THEN** a tab labeled "app.log" with an × button is displayed at the top of the pane

#### Scenario: Multiple files open

- **GIVEN** a pane with three files ["app.log", "error.log", "access.log"] open, with "error.log" active
- **WHEN** the pane is rendered
- **THEN** three tabs are displayed in order: "app.log", "error.log" (highlighted as active), "access.log"

### Requirement: Click tab to switch active file

The system SHALL allow users to switch the active file in a pane by clicking on its tab.

#### Scenario: Switch to another tab

- **GIVEN** a pane with files ["app.log", "error.log"] open, with "app.log" active
- **WHEN** user clicks on the "error.log" tab
- **THEN** "error.log" becomes the active file
- **AND** the tab appears highlighted
- **AND** the LogViewer displays "error.log" content

### Requirement: Close tab with middle-click

The system SHALL allow users to close a tab by middle-clicking on it.

#### Scenario: Middle-click closes tab

- **GIVEN** a pane with files ["app.log", "error.log"] open
- **WHEN** user middle-clicks on the "error.log" tab
- **THEN** the "error.log" tab is removed
- **AND** the remaining tabs ["app.log"] are displayed
- **AND** if "error.log" was active, "app.log" becomes active

#### Scenario: Last tab closure shows empty state

- **GIVEN** a pane with only "app.log" open and active
- **WHEN** the user closes "app.log" (middle-click or × button)
- **THEN** the pane shows the empty state (file picker)
- **AND** no tabs are displayed in the tab bar

### Requirement: Close tab with × button

Each tab SHALL have a close button (×) that closes that specific tab when clicked.

#### Scenario: Click × to close tab

- **GIVEN** a pane with files ["app.log", "error.log"] open
- **WHEN** user clicks the × button on the "error.log" tab
- **THEN** the "error.log" tab is removed
- **AND** "app.log" remains open and active

### Requirement: Drag tabs to reorder

The system SHALL allow users to reorder tabs within a pane by dragging them.

#### Scenario: Drag tab to new position

- **GIVEN** a pane with tabs ["app.log", "error.log", "access.log"] in order
- **WHEN** user drags "access.log" to the left of "app.log"
- **THEN** the tab order becomes ["access.log", "app.log", "error.log"]

### Requirement: Tab shows file icon

Each tab SHALL display a file icon appropriate for log files.

#### Scenario: Tab displays file icon

- **GIVEN** a pane with file "app.log" open
- **WHEN** the tab is rendered
- **THEN** a document/file icon is displayed to the left of the file name