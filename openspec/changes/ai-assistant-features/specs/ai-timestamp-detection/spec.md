# AI Timestamp Detection Specification

## Overview

AI Timestamp Detection analyzes log samples to automatically identify timestamp formats, enabling quick configuration of time range filters without manual pattern matching.

## ADDED Requirements

### Requirement: User can trigger AI timestamp detection

The system SHALL provide a button to trigger AI-based timestamp format detection in the Time Range layer configuration.

#### Scenario: User clicks "AI Detect" button
- **WHEN** user clicks "AI Detect" button in Time Range layer panel
- **THEN** system samples first 1000 lines of the current log file
- **AND** sends sample to timestamp detection service

#### Scenario: No file is loaded
- **WHEN** user clicks "AI Detect" without loading a file
- **THEN** system shows message: "Please open a log file first"

### Requirement: System detects common timestamp formats

The detection service SHALL identify common timestamp patterns including ISO8601, Unix timestamp, and common log formats.

#### Scenario: ISO8601 format detected
- **WHEN** log contains ISO8601 timestamps (e.g., "2026-01-15T14:32:00.123Z")
- **THEN** system returns format string: "%Y-%m-%dT%H:%M:%S.%fZ"
- **AND** returns regex pattern with capture group

#### Scenario: Common log format detected
- **WHEN** log contains standard log format (e.g., "2026-01-15 14:32:00")
- **THEN** system returns format string: "%Y-%m-%d %H:%M:%S"
- **AND** returns regex pattern: r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})"

#### Scenario: Unix timestamp detected
- **WHEN** log contains Unix epoch timestamps
- **THEN** system returns format string: "unix"
- **AND** returns regex pattern matching digits

### Requirement: Detection results populate form fields

Successful detection SHALL automatically fill in the pattern and format fields.

#### Scenario: Detection succeeds
- **WHEN** timestamp detection completes successfully
- **THEN** pattern field is populated with detected regex
- **AND** format field is populated with detected format
- **AND** start/end fields show detected min/max timestamps

#### Scenario: Detection fails
- **WHEN** no timestamp pattern is found
- **THEN** system shows message: "Could not detect timestamp format. Please configure manually."
- **AND** form fields remain unchanged

### Requirement: Detected time range is suggested

The detection SHALL also identify the minimum and maximum timestamps in the sample.

#### Scenario: Time range detected
- **WHEN** detection identifies timestamp range
- **THEN** start time field is populated with earliest timestamp
- **AND** end time field is populated with latest timestamp
- **AND** user can adjust before applying

## Technical Requirements

### Requirement: Detection uses sampling for performance

The detection SHALL analyze only a sample of lines, not the entire file.

#### Scenario: Large file detection
- **WHEN** detecting timestamps in file with 1M+ lines
- **THEN** system samples only first 1000 lines
- **AND** detection completes within 2 seconds

### Requirement: Detection supports fallback

When AI providers are unavailable, detection SHALL use heuristic-based fallback.

#### Scenario: Using heuristic fallback
- **WHEN** no AI provider is configured
- **THEN** system uses regex-based pattern matching
- **AND** still provides timestamp detection capability
