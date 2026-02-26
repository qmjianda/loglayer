## ADDED Requirements

### Requirement: Unified Icon System
The system SHALL use lucide-react as the single source for all UI icons.

#### Scenario: All icons render correctly
- **WHEN** any component displays an icon (file, search, filter, bookmark, settings)
- **THEN** icon is rendered from lucide-react library
- **AND** icon size matches design token (16px, 20px, or 24px)
- **AND** icon color inherits from text color context

#### Scenario: Icon accessibility
- **WHEN** screen reader encounters an icon button
- **THEN** icon has appropriate aria-label or is hidden with sr-only text

#### Scenario: Icon tree-shaking
- **WHEN** application is bundled for production
- **THEN** only imported icons are included in bundle
- **AND** unused icons are eliminated via tree-shaking

### Requirement: Icon Component Wrapper
The system SHALL provide a consistent Icon component wrapper for all icons.

#### Scenario: Icon with custom size
- **WHEN** component renders Icon with size prop
- **THEN** icon renders at exact specified size
- **AND** maintains aspect ratio

#### Scenario: Icon with custom color
- **WHEN** component renders Icon with color prop
- **THEN** icon fills with specified color
- **AND** color responds to theme changes
