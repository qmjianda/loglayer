# Spec: search-status-bar

## ADDED Requirements

### Requirement: Search results counter
The search panel SHALL display the total number of matches found.

#### Scenario: Display match count after search
- **WHEN** user performs a search (presses Enter)
- **AND** the search completes
- **THEN** SHALL display "X matches" in the search panel header

#### Scenario: Display zero matches
- **WHEN** user searches for a term with no matches
- **THEN** SHALL display "No matches" with a clear indicator

#### Scenario: Update count during incremental search
- **WHEN** user types in search input with regex
- **AND** debounce timer completes
- **THEN** SHALL update the match count in real-time

### Requirement: Current match position
The search panel SHALL indicate the user's current position among matches.

#### Scenario: Display current position
- **WHEN** user navigates to a search result (F3/Shift+F3)
- **THEN** SHALL display "X of Y" (e.g., "5 of 234")

#### Scenario: Current position after search
- **WHEN** search completes
- **AND** user has not navigated yet
- **THEN** SHALL display "0 of Y" initially
- **AND** SHALL update to "1 of Y" after first navigation

### Requirement: Search highlighting statistics
The search panel SHALL provide information about highlighting.

#### Scenario: Highlight all toggle
- **WHEN** user enables "Highlight All" in search options
- **THEN** SHALL display highlight count indicator
- **AND** SHALL update when search term changes

#### Scenario: Large result set handling
- **WHEN** search returns more than 10,000 matches
- **THEN** SHALL display "10,000+ matches" (capped display)
- **AND** SHALL still allow navigation to all results

### Requirement: Search status integration with StatusBar
The StatusBar SHALL show a subtle search indicator when search is active.

#### Scenario: Search active indicator
- **WHEN** user has an active search term
- **AND** search results exist
- **THEN** StatusBar SHALL show a small search icon with match count

#### Scenario: Clear search indicator
- **WHEN** user clears the search input
- **THEN** the search indicator SHALL disappear from StatusBar
