## ADDED Requirements

### Requirement: JSON Detection
The system SHALL automatically detect JSON strings in log lines.

#### Scenario: Detect JSON content
- **WHEN** a log line contains valid JSON object or array
- **THEN** system marks it as JSON-expandable

### Requirement: JSON Tree Expansion
The system SHALL render JSON content as expandable tree structure.

#### Scenario: Expand JSON
- **WHEN** user clicks expand icon next to JSON line
- **THEN** system shows tree view of JSON keys and values

#### Scenario: Collapse JSON
- **WHEN** user clicks collapse icon on expanded JSON
- **THEN** system hides tree view and shows original line

#### Scenario: Expand/Collapse all
- **WHEN** user right-clicks on JSON line
- **THEN** system shows context menu with "Expand All" / "Collapse All" options

### Requirement: JSON Syntax Highlighting
The system SHALL apply syntax highlighting to JSON tree values.

#### Scenario: Value type coloring
- **WHEN** JSON tree is displayed
- **THEN** strings are green, numbers are blue, booleans are purple, null is gray
