# module-design-docs Specification

## Purpose

Create comprehensive architecture documentation for core modules, enabling AI assistants and human developers to quickly understand the system without reading all source code.

## Requirements

### Requirement: Core Module Documentation

Each core module SHALL have a design document explaining its architecture.

#### Scenario: Required module docs

- **WHEN** documenting the codebase
- **THEN** the following modules SHALL have design documents:
  - `LogViewer`: Canvas rendering, virtual scrolling, event handling
  - `LayerEngine`: Layer pipeline, stage execution, plugin system
  - `Bridge`: Frontend-backend communication, REST/WebSocket patterns
  - `AppState`: State flow, hooks architecture, state ownership

#### Scenario: Document structure

- **WHEN** a module design document is created
- **THEN** it SHALL include:
  - Overview: One-paragraph summary
  - Architecture: Component diagram or flow description
  - Key Concepts: Important abstractions and patterns
  - Data Flow: How data moves through the module
  - API Surface: Public functions/classes/interfaces
  - Dependencies: What other modules it depends on
  - Extension Points: Where to add new functionality

### Requirement: Architecture Decision Records

Significant architectural decisions SHALL be documented as ADRs.

#### Scenario: ADR triggers

- **WHEN** a decision affects multiple modules or introduces constraints
- **THEN** an Architecture Decision Record SHALL be created
- **AND** the ADR SHALL be added to `docs/TECHNICAL_DECISIONS.md`

#### Scenario: ADR format

- **WHEN** creating an ADR
- **THEN** it SHALL follow the format:
  - Title: Decision name
  - Status: Proposed/Accepted/Deprecated
  - Context: Why this decision was needed
  - Decision: What was decided
  - Consequences: Impact (positive and negative)

### Requirement: AGENTS.md Maintenance

`AGENTS.md` SHALL be the primary entry point for AI assistants.

#### Scenario: AGENTS.md completeness

- **WHEN** an AI assistant starts a new session
- **THEN** `AGENTS.md` SHALL provide:
  - Project description (1-2 sentences)
  - Key file locations
  - Core patterns to follow
  - Common commands
  - Documentation index

#### Scenario: AGENTS.md updates

- **WHEN** a new pattern or convention is established
- **THEN** `AGENTS.md` SHALL be updated to reference it
- **AND** the update SHALL be made in the same PR as the code change

### Requirement: Type System Documentation

The relationship between frontend and backend types SHALL be documented.

#### Scenario: Type sync documentation

- **WHEN** documenting the type system
- **THEN** `docs/TYPE_SYNC.md` SHALL exist
- **AND** it SHALL list each type pair (Python/TypeScript)
- **AND** it SHALL document the sync process

### Requirement: API Documentation

All API endpoints SHALL be documented.

#### Scenario: Endpoint documentation

- **WHEN** an API endpoint is added
- **THEN** it SHALL be documented with:
  - HTTP method and path
  - Request parameters/body
  - Response format
  - Error codes
  - Example usage

#### Scenario: API documentation location

- **WHEN** API documentation is needed
- **THEN** it SHALL be in `docs/API.md` or inline in `main.py` docstrings
- **AND** OpenAPI spec SHALL be auto-generated from FastAPI routes

### Requirement: Diagram Requirements

Complex data flows SHALL be illustrated with diagrams.

#### Scenario: Mermaid diagram usage

- **WHEN** a data flow or architecture needs visualization
- **THEN** a Mermaid diagram SHALL be included in the relevant doc
- **AND** the diagram SHALL be kept in sync with code changes