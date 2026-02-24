## ADDED Requirements

### Requirement: Log Level Statistics
The system SHALL display count of log lines by level (ERROR, WARN, INFO, DEBUG, etc.).

#### Scenario: Show level distribution
- **WHEN** user opens log file
- **THEN** statistics panel shows count for each log level

#### Scenario: Update statistics on filter
- **WHEN** user applies filters
- **THEN** statistics panel updates to show filtered results count

### Requirement: Statistics Panel Display
The system SHALL show statistics in a collapsible panel.

#### Scenario: Toggle statistics panel
- **WHEN** user clicks "Stats" button in toolbar
- **THEN** statistics panel slides in from right side

#### Scenario: Show percentage
- **WHEN** statistics are displayed
- **THEN** each level shows both count and percentage

### Requirement: Visual Level Indicators
The system SHALL use color-coded bars to visualize level distribution.

#### Scenario: Color-coded bars
- **WHEN** statistics are displayed
- **THEN** each level has a colored bar proportional to its count (ERROR=red, WARN=yellow, INFO=green)
