## ADDED Requirements

### Requirement: SQL-like Query Parsing
The system SHALL parse SQL-like query syntax and convert it to regex for filtering log lines.

#### Scenario: Basic equality filter
- **WHEN** user enters `level=ERROR` in search box
- **THEN** system filters to lines containing `level: ERROR` or `ERROR`

#### Scenario: AND condition
- **WHEN** user enters `level=ERROR AND message CONTAINS "timeout"`
- **THEN** system filters to lines containing both `ERROR` and `timeout`

#### Scenario: OR condition
- **WHEN** user enters `level=ERROR OR level=WARN`
- **THEN** system filters to lines containing either `ERROR` or `WARN`

#### Scenario: NOT condition
- **WHEN** user enters `NOT level=INFO`
- **THEN** system filters to lines NOT containing `INFO`

### Requirement: Query Syntax Detection
The system SHALL automatically detect whether input is SQL-like or plain regex.

#### Scenario: Auto-detection of SQL syntax
- **WHEN** user input contains `=` or `AND` or `OR` or `CONTAINS`
- **THEN** system treats it as SQL-like query

#### Scenario: Fallback to regex
- **WHEN** user input does not match SQL-like patterns
- **THEN** system treats it as regular regex

### Requirement: Query Error Display
The system SHALL display clear error messages for invalid SQL-like queries.

#### Scenario: Invalid syntax
- **WHEN** user enters malformed SQL-like query like `level= AND`
- **THEN** system shows error "Invalid query syntax" below search box
