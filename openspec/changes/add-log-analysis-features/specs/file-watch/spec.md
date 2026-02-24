## ADDED Requirements

### Requirement: File Watch Toggle
The system SHALL provide a toggle to enable/disable file watching mode.

#### Scenario: Enable watch mode
- **WHEN** user clicks "Watch" button in toolbar or presses Ctrl+Shift+T
- **THEN** system starts monitoring file for changes

#### Scenario: Disable watch mode
- **WHEN** user clicks "Stop Watching" button while in watch mode
- **THEN** system stops monitoring the file

### Requirement: Auto-scroll on New Content
The system SHALL automatically scroll to show new content when in watch mode.

#### Scenario: Auto-scroll to new lines
- **WHEN** file has new content added and user is at bottom of view
- **THEN** system scrolls to show new lines automatically

#### Scenario: Manual scroll pause auto-scroll
- **WHEN** user scrolls up while in watch mode
- **THEN** system pauses auto-scroll and shows "New content available" button

#### Scenario: Resume auto-scroll
- **WHEN** user clicks "Scroll to bottom" after manual scroll
- **THEN** system resumes auto-scroll behavior

### Requirement: Visual Indicator for Watch Mode
The system SHALL show a visual indicator when watch mode is active.

#### Scenario: Watch mode indicator
- **WHEN** watch mode is active
- **THEN** status bar shows "Watching" with pulsing dot indicator
