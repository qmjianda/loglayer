# storage-manager Specification

## Purpose

Centralize all localStorage operations into a single, type-safe, and migratable storage layer, eliminating scattered direct localStorage access and enabling future storage backend changes.

## Requirements

### Requirement: Centralized Storage Access

All localStorage operations SHALL go through the StorageManager class.

#### Scenario: Direct localStorage access prohibited

- **WHEN** code needs to read or write persistent data
- **THEN** it SHALL use `StorageManager.get()` or `StorageManager.set()`
- **AND** direct `localStorage.getItem()` or `localStorage.setItem()` calls SHALL NOT exist outside StorageManager

#### Scenario: Type-safe storage keys

- **WHEN** a developer accesses storage
- **THEN** only predefined keys from `StorageSchema` SHALL be accepted
- **AND** TypeScript SHALL enforce key types at compile time

### Requirement: Storage Schema Definition

All stored values SHALL be defined in a central schema.

#### Scenario: Schema completeness

- **WHEN** a new persistent value is added
- **THEN** the developer SHALL add it to `StorageSchema` interface
- **AND** the schema SHALL define the key name with prefix `loglayer.`
- **AND** the schema SHALL define the value type

#### Scenario: Schema example

```typescript
interface StorageSchema {
  'loglayer.presets': LayerPreset[];
  'loglayer.settings': AppSettings;
  'loglayer.searchHistory': string[];
  'loglayer.sidebarWidth': number;
}
```

### Requirement: Default Values

All storage keys SHALL have documented default values.

#### Scenario: Missing key handling

- **WHEN** a storage key does not exist in localStorage
- **THEN** StorageManager SHALL return the default value for that key
- **AND** the default value SHALL be documented in the schema

#### Scenario: Invalid value handling

- **WHEN** a stored value cannot be parsed (corrupted JSON)
- **THEN** StorageManager SHALL return the default value
- **AND** StorageManager SHALL log a warning with the error

### Requirement: Migration Support

StorageManager SHALL support schema migrations for versioned updates.

#### Scenario: Schema version check

- **WHEN** StorageManager initializes
- **THEN** it SHALL check the stored schema version
- **AND** if version is outdated, it SHALL run migration functions

#### Scenario: Migration execution

- **WHEN** a migration is needed
- **THEN** StorageManager SHALL execute migration functions in order
- **AND** each migration SHALL update the stored data to match the new schema
- **AND** StorageManager SHALL update the version number after migration

### Requirement: Migration Documentation

All migrations SHALL be documented.

#### Scenario: Migration record

- **WHEN** a new migration is added
- **THEN** it SHALL be documented with:
  - Version number
  - Date added
  - Description of changes
  - Author

### Requirement: Storage Debugging

StorageManager SHALL provide debugging utilities.

#### Scenario: Storage inspection

- **WHEN** debug mode is enabled
- **THEN** StorageManager SHALL log all read/write operations
- **AND** StorageManager SHALL provide a method to dump all stored values