# Spec: theme-completion

## ADDED Requirements

### Requirement: RemotePathPicker theme support
The RemotePathPicker component SHALL support light and dark themes.

#### Scenario: RemotePathPicker background in light mode
- **WHEN** user has set theme to "light"
- **AND** opens the RemotePathPicker
- **THEN** the background SHALL use `var(--bg-surface)` (#ffffff)
- **AND** NOT use hardcoded #1e1e1e

#### Scenario: RemotePathPicker background in dark mode
- **WHEN** user has set theme to "dark"
- **AND** opens the RemotePathPicker
- **THEN** the background SHALL use `var(--bg-surface)` (#1e1e1e)

#### Scenario: RemotePathPicker text colors
- **WHEN** RemotePathPicker is displayed
- **THEN** text SHALL use theme variables (--text-primary, --text-secondary, --text-muted)

#### Scenario: RemotePathPicker borders
- **WHEN** RemotePathPicker is displayed
- **THEN** borders SHALL use `var(--border-default)` or `var(--border-subtle)`

### Requirement: Canvas rendering theme support
The LogViewer Canvas SHALL use theme-appropriate colors.

#### Scenario: Canvas background in light mode
- **WHEN** theme is "light"
- **AND** LogViewer renders
- **THEN** background SHALL be COLORS.LIGHT.BACKGROUND (#ffffff)

#### Scenario: Canvas background in dark mode
- **WHEN** theme is "dark"
- **AND** LogViewer renders
- **THEN** background SHALL be COLORS.DARK.BACKGROUND (#1e1e1e)

#### Scenario: Canvas text color theming
- **WHEN** LogViewer renders text
- **THEN** text color SHALL use COLORS[theme].TEXT
- **AND** SHALL dynamically switch when theme changes

#### Scenario: Theme switch during active viewing
- **WHEN** user switches theme while viewing a file
- **THEN** Canvas SHALL repaint with new colors within 100ms
- **AND** SHALL NOT cause visual flicker

### Requirement: All components use theme variables
All UI components SHALL use theme CSS variables instead of hardcoded colors.

#### Scenario: Component audit
- **WHEN** reviewing component code
- **THEN** no component SHALL contain hardcoded hex colors like #1e1e1e, #252526, #333333

#### Scenario: Fallback for missing theme variable
- **WHEN** a component uses a theme variable
- **AND** the variable is not defined
- **THEN** SHALL have a sensible fallback color

### Requirement: Theme transition smoothness
Theme changes SHALL be visually smooth.

#### Scenario: Transition duration
- **WHEN** user switches theme
- **THEN** color transitions SHALL complete within 200ms

#### Scenario: No flash of wrong theme
- **WHEN** page loads
- **AND** saved theme is "light"
- **THEN** initial render SHALL use light theme colors
- **AND** SHALL NOT flash dark colors first
