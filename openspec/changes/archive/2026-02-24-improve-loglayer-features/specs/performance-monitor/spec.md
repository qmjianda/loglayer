# Spec: performance-monitor

## ADDED Requirements

### Requirement: Performance Monitor displays system metrics
The system SHALL display real-time performance metrics in the StatusBar area.

#### Scenario: Display FPS metric
- **WHEN** the user has a file open and is scrolling
- **THEN** the FPS counter SHALL update every 1 second
- **AND** SHALL display a value between 0-60

#### Scenario: Display memory usage metric
- **WHEN** the performance monitor is active
- **THEN** SHALL display current memory usage in MB
- **AND** SHALL update every 2 seconds

#### Scenario: Display virtual scroll status
- **WHEN** viewing a file with virtual scrolling enabled
- **THEN** SHALL display cache utilization (e.g., "2345/5000")

#### Scenario: Performance monitor visibility
- **WHEN** the user has not opened any file
- **THEN** the performance monitor SHALL be hidden
- **AND** SHALL appear within 500ms after file load completes

### Requirement: Performance Monitor integrates with usePerformanceOptimization
The performance monitor SHALL use the existing usePerformanceOptimization hook.

#### Scenario: Memory warning threshold
- **WHEN** memory usage exceeds 500MB
- **AND** settings.debugMode is enabled
- **THEN** SHALL display a warning indicator

#### Scenario: Low FPS warning
- **WHEN** average FPS drops below 30
- **AND** settings.debugMode is enabled
- **THEN** SHALL display a warning indicator

### Requirement: Performance metrics are configurable
The user SHALL be able to control performance monitor visibility.

#### Scenario: Toggle performance monitor
- **WHEN** user opens Settings > Advanced > Debug Mode
- **AND** enables "Show Performance Stats"
- **THEN** the performance metrics SHALL appear in StatusBar
- **AND** SHALL persist across sessions

#### Scenario: Performance impact
- **WHEN** performance monitor is visible
- **THEN** the additional CPU usage SHALL be less than 1%
- **AND** SHALL not cause frame drops in the log viewer
