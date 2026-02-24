# AI Settings Specification

## Overview

AI Settings allows users to configure AI provider preferences, API keys, and model selection. Settings are persisted and used across sessions.

## ADDED Requirements

### Requirement: User can select AI provider

The system SHALL provide a dropdown to select between local and cloud AI providers.

#### Scenario: User selects provider
- **WHEN** user opens Settings > AI
- **THEN** provider dropdown shows options: "Cloud (OpenAI)", "Local (Ollama)", "Heuristic (Offline)"
- **AND** selecting a provider updates the available model options

#### Scenario: Provider options based on availability
- **WHEN** options are loaded
- **THEN** Ollama is shown only if local Ollama service is detected
- **AND** user is informed if Ollama is not running

### Requirement: User can configure API key

The system SHALL provide secure input for API key configuration.

#### Scenario: User enters API key
- **WHEN** user types in API key field
- **THEN** input is masked (password field)
- **AND** "Show" toggle reveals key temporarily

#### Scenario: API key is saved
- **WHEN** user clicks "Save" after entering key
- **THEN** key is stored in system keychain (not plain text)
- **AND** success message is shown

#### Scenario: API key is invalid
- **WHEN** user saves an invalid API key
- **THEN** system shows error: "Invalid API key. Please check and try again."
- **AND** key is not saved

### Requirement: User can select AI model

The system SHALL provide model selection based on the chosen provider.

#### Scenario: OpenAI models shown
- **WHEN** user selects "Cloud (OpenAI)" provider
- **THEN** model dropdown shows: "gpt-4o-mini", "gpt-4o", "gpt-4-turbo"
- **AND** default selection is "gpt-4o-mini" (cost-effective)

#### Scenario: Ollama models shown
- **WHEN** user selects "Local (Ollama)" provider
- **THEN** model dropdown fetches available models from local Ollama
- **AND** shows loading state while fetching

### Requirement: User can test AI connection

The system SHALL provide a way to verify AI connectivity.

#### Scenario: Test connection succeeds
- **WHEN** user clicks "Test Connection"
- **THEN** system attempts to connect to configured provider
- **AND** shows success message with response time

#### Scenario: Test connection fails
- **WHEN** connection test fails
- **THEN** system shows error with possible causes
- **AND** suggests troubleshooting steps

### Requirement: Settings persist across sessions

AI settings SHALL be saved and restored when the application restarts.

#### Scenario: Settings restored
- **WHEN** application starts
- **THEN** AI settings are loaded from storage
- **AND** provider and model selections are restored

### Requirement: Graceful degradation when AI unavailable

The system SHALL function normally even when AI is not configured.

#### Scenario: AI not configured, user tries AI feature
- **WHEN** user attempts AI feature without configuration
- **THEN** friendly message directs user to Settings
- **AND** all non-AI features remain fully functional

## Security Requirements

### Requirement: API keys are stored securely

API keys SHALL NOT be stored in plain text or version control.

#### Scenario: Key storage
- **WHEN** API key is saved
- **THEN** it is stored using system keychain
- **AND** never appears in logs or error messages

### Requirement: API key can be cleared

Users SHALL be able to remove stored API keys.

#### Scenario: Clear API key
- **WHEN** user clicks "Clear" on API key field
- **THEN** key is removed from storage
- **AND** provider shows as "Not configured"

## UI Requirements

### Requirement: Settings are in dedicated AI section

AI settings SHALL be accessible from the main Settings panel.

#### Scenario: AI settings location
- **WHEN** user opens Settings
- **THEN** "AI" section is visible in the sidebar
- **AND** clicking opens AI configuration panel
