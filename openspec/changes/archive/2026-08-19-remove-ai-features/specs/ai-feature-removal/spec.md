## ADDED Requirements

### Requirement: AI surface is absent
The application MUST NOT ship AI providers, AI configuration state, AI chat/settings UI, AI-only commands/context-menu actions, or API-key injection.

#### Scenario: Backend starts without AI routes
- **WHEN** the FastAPI application is imported
- **THEN** no route path starts with `/api/ai/`
- **AND** importing the application does not require the deleted `backend.ai` package

#### Scenario: Frontend has no AI entry points
- **WHEN** the frontend source and package configuration are audited
- **THEN** no AI component, hook, command, context-menu action, or Gemini/OpenAI/Ollama reference remains
- **AND** the frontend build has no AI API-key environment injection

### Requirement: Ordinary log analysis remains available
Removing AI MUST NOT remove ordinary log analysis capabilities or non-AI time-range configuration.

#### Scenario: Time-range layer remains configurable
- **WHEN** a TIME_RANGE layer is rendered by the dynamic form
- **THEN** its ordinary fields are rendered and editable
- **AND** no AI-only controls or replacement API are required

#### Scenario: Normal log actions remain available
- **WHEN** a user uses the log viewer and context menu
- **THEN** copy, highlight, filter, bookmark, and copy-line actions remain available
- **AND** no AI action is shown
