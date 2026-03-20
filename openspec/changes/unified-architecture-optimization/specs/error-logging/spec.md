# error-logging Specification

## Purpose

Ensure all errors are logged with sufficient context for debugging, eliminating silent failures and enabling rapid issue diagnosis.

## ADDED Requirements

### Requirement: Typed Error Classes

The backend SHALL define a hierarchy of typed error classes for structured error handling.

#### Scenario: Error class definition

- **WHEN** a new error type is needed
- **THEN** it SHALL extend `LogLayerError` base class
- **AND** it SHALL define a unique `code` attribute
- **AND** it SHALL define a `message` attribute

#### Scenario: Standard error codes

- **WHEN** raising an error
- **THEN** one of the predefined error codes SHALL be used:
  - `FILE_NOT_FOUND`
  - `INVALID_PARAMS`
  - `OPERATION_FAILED`
  - `PERMISSION_DENIED`
  - `INTERNAL_ERROR`

### Requirement: Error Response Standard

All API errors SHALL return a standardized response format.

#### Scenario: API error response

- **WHEN** an API endpoint encounters an error
- **THEN** the response SHALL include:
  - `success: false`
  - `error.code`: The error code
  - `error.message`: Human-readable message
  - `error.details`: Optional additional context

### Requirement: Frontend Error Handler

The frontend SHALL have a centralized error handling utility.

#### Scenario: Error handler usage

- **WHEN** an API call fails
- **THEN** `handleApiError()` SHALL process the error
- **AND** the handler SHALL log the error with context
- **AND** the handler SHALL return a user-friendly message

## MODIFIED Requirements

### Requirement: Error Logging for Silent Catch Blocks

When JSON parsing fails in localStorage operations, the error MUST be logged to aid debugging.

#### Scenario: JSON parse error in getHistoryLimit

- **WHEN** localStorage contains invalid JSON in the settings key
- **THEN** the function SHALL return the default limit (50)
- **AND** a warning SHALL be logged to the console with the error details
- **AND** the warning SHALL include the storage key name

#### Scenario: JSON parse error in search history loading

- **WHEN** localStorage contains invalid JSON in the search history key
- **THEN** the search history state SHALL remain empty ([])
- **AND** a warning SHALL be logged to the console with the error details
- **AND** the warning SHALL include the storage key name

#### Scenario: General catch block logging

- **WHEN** any exception is caught in a try/catch block
- **THEN** the exception SHALL be logged with:
  - Error type/class
  - Error message
  - Stack trace (if available)
  - Context (what operation was being performed)
- **AND** empty catch blocks are NOT permitted