# type-sync-system Specification

## Purpose

Ensure type definitions stay synchronized between TypeScript frontend (`types.ts`) and Python backend (`schemas.py`) to prevent API contract violations and enable type-safe development.

## Requirements

### Requirement: Type Definition Mirror

Every Pydantic model in `backend/loglayer/schemas.py` SHALL have a corresponding TypeScript interface in `frontend/src/types.ts` with matching field names and types.

#### Scenario: New type added to backend

- **WHEN** a developer adds a new Pydantic model to `schemas.py`
- **THEN** the developer MUST add the corresponding TypeScript interface to `types.ts`
- **AND** both types MUST have the same field names (accounting for snake_case/camelCase convention)
- **AND** both types MUST have equivalent field types

#### Scenario: Type count mismatch detection

- **WHEN** CI pipeline runs
- **THEN** the build SHALL compare type counts between `schemas.py` and `types.ts`
- **AND** the build SHALL fail if counts do not match
- **AND** the error message SHALL indicate which file has more/fewer types

### Requirement: Type Documentation

All shared types SHALL be documented with their purpose and counterpart location.

#### Scenario: Type documentation format

- **WHEN** a developer defines a shared type
- **THEN** the type SHALL include a comment referencing its counterpart
- **AND** the comment format SHALL be: `// Mirror: backend/loglayer/schemas.py::TypeName` (TypeScript) or `# Mirror: frontend/src/types.ts::TypeName` (Python)

### Requirement: Any Type Elimination

The codebase SHALL minimize `any` type usage in TypeScript.

#### Scenario: Any type count limit

- **WHEN** CI pipeline runs type checking
- **THEN** the build SHALL fail if `any` type count exceeds 10
- **AND** each `any` usage MUST have an inline comment justifying why it cannot be typed

#### Scenario: New code without any

- **WHEN** a developer writes new TypeScript code
- **THEN** the developer MUST NOT use `any` type
- **AND** the developer SHALL use `unknown` with type guards if type is truly unknown

### Requirement: Parameter Naming Convention

API boundary parameters SHALL follow language-specific conventions with transformation at the boundary.

#### Scenario: Python API parameter naming

- **WHEN** a Python API endpoint receives parameters
- **THEN** the parameters SHALL use snake_case naming
- **AND** the FastAPI route definitions SHALL use snake_case

#### Scenario: TypeScript API call naming

- **WHEN** a TypeScript function calls a Python API
- **THEN** the function parameters SHALL use camelCase naming
- **AND** `bridge_client.ts` SHALL transform camelCase to snake_case when making requests