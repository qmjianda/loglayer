## MODIFIED Requirements

### Requirement: Application State Management
The system SHALL manage application state using React Context to avoid props drilling.

#### Scenario: File state accessible everywhere
- **WHEN** any component needs file information
- **THEN** it can access FileContext
- **AND** no props passing through intermediate components

#### Scenario: Layer state accessible everywhere
- **WHEN** any component needs layer information
- **THEN** it can access LayerContext
- **AND** layer operations work from any component

#### Scenario: Context performance optimized
- **WHEN** state changes in one context
- **THEN** only components consuming that specific context re-render
- **AND** unrelated components do not re-render

### Requirement: App Architecture Refactoring
The system SHALL refactor App.tsx into separated concerns.

#### Scenario: FileContext manages files
- **WHEN** file operations occur (open, close, switch)
- **THEN** FileContext provides: files, activeFileId, addFile, removeFile, setActiveFile
- **AND** business logic stays in hooks, not in component

#### Scenario: LayerContext manages layers
- **WHEN** layer operations occur (add, remove, update, reorder)
- **THEN** LayerContext provides: layers, addLayer, updateLayer, removeLayer, reorderLayers
- **AND** layer state is centralized

#### Scenario: Layout extracted
- **WHEN** main layout renders
- **THEN** MainLayout component handles structure
- **AND** App.tsx only orchestrates providers and renders MainLayout

#### Scenario: Hooks consolidated
- **WHEN** developer needs file/layer/search functionality
- **THEN** they import from consolidated hooks
- **AND** duplicate/overlapping hooks are eliminated
