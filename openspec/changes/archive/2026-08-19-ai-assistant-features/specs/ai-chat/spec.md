# AI Chat Specification

## Overview

AI Chat capability allows users to paste log content or select log lines and send them to AI for analysis. The AI responds with insights, pattern detection, and actionable suggestions.

## ADDED Requirements

### Requirement: User can paste log content for AI analysis

The system SHALL provide a text input area where users can paste log content for AI analysis. The input SHALL accept text up to 500KB.

#### Scenario: User pastes log content
- **WHEN** user pastes text into the AI chat input area
- **THEN** the text appears in the input area
- **AND** the "Send" button becomes enabled

#### Scenario: User pastes content exceeding limit
- **WHEN** user pastes text larger than 500KB
- **THEN** system shows a warning message
- **AND** allows user to proceed with truncated content (first 500KB)

### Requirement: User can select log lines and send to AI

The system SHALL provide a context menu option to send selected log lines to AI chat.

#### Scenario: User right-clicks on selected text
- **WHEN** user has selected log text and right-clicks
- **THEN** context menu shows "Send to AI" option

#### Scenario: User clicks "Send to AI"
- **WHEN** user clicks "Send to AI" from context menu
- **THEN** selected text is added to AI chat input
- **AND** chat panel opens (if closed)

### Requirement: AI responds with log analysis

The system SHALL send user content to configured AI provider and display the response.

#### Scenario: AI responds successfully
- **WHEN** user sends content to AI
- **THEN** loading indicator shows during processing
- **AND** AI response appears in chat after completion

#### Scenario: AI provider is not configured
- **WHEN** user sends content without configuring AI
- **THEN** system shows message: "Please configure AI in Settings to use this feature"
- **AND** provides link to open Settings

#### Scenario: AI request fails
- **WHEN** AI request fails (network error, auth error, etc.)
- **THEN** system shows error message with brief reason
- **AND** allows user to retry

### Requirement: AI chat history is session-scoped

The system SHALL maintain chat messages during the current session only.

#### Scenario: User starts new conversation
- **WHEN** user refreshes the page or opens new file
- **THEN** chat history is cleared
- **AND** no previous messages are shown

### Requirement: AI suggests actionable items

The AI response MAY include suggested actions that users can apply with one click.

#### Scenario: AI suggests filter
- **WHEN** AI response contains filter suggestion
- **THEN** suggestion appears as clickable button: "Apply Filter: level=ERROR"
- **AND** clicking applies the filter layer

#### Scenario: AI suggests highlight
- **WHEN** AI response contains highlight suggestion
- **THEN** suggestion appears as clickable button: "Apply Highlight: 'Connection refused'"
- **AND** clicking applies the highlight layer

## UI/UX Requirements

### Requirement: Chat panel is accessible from sidebar

The AI chat panel SHALL be accessible from the sidebar panel system.

#### Scenario: Opening AI chat panel
- **WHEN** user clicks AI icon in sidebar
- **THEN** AI chat panel opens in the main content area
- **AND** previous panel state is preserved

### Requirement: Chat shows connection status

The chat panel SHALL display current AI provider and connection status.

#### Scenario: Provider is connected
- **WHEN** AI provider is configured and connected
- **THEN** status indicator shows green dot
- **AND** displays provider name (e.g., "OpenAI • gpt-4o-mini")

#### Scenario: Provider is disconnected
- **WHEN** AI provider is not connected
- **THEN** status indicator shows orange dot
- **AND** displays "Not configured"
