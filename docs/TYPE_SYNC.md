# Type Synchronization Reference

> This document tracks all type definitions that must stay synchronized between TypeScript frontend and Python backend.

---

## Overview

LogLayer uses manual type synchronization between:
- **Frontend**: `frontend/src/types.ts` (TypeScript interfaces)
- **Backend**: `backend/loglayer/schemas.py` (Pydantic models)

**Rule**: When adding or modifying types, update both files and ensure field names/types match (accounting for snake_case/camelCase convention).

---

## Synchronized Types

### Core Layer Types

| TypeScript (`types.ts`) | Python (`schemas.py`) | Status |
|------------------------|----------------------|--------|
| `LayerType` (enum) | `LayerTypeEnum` (enum) | ✅ Synced |
| `LayerUIField` | `LayerUIField` | ✅ Synced |
| `LayerRegistryEntry` | `LayerRegistryEntry` | ✅ Synced |
| `LayerConfig` | `LayerConfig` | ✅ Synced |
| `LogLayer` | `LogLayer` | ✅ Synced |
| `LayerPreset` | `LayerPreset` | ✅ Synced |
| `LayerStats` | `LayerStats` | ✅ Synced |

### Data Types

| TypeScript (`types.ts`) | Python (`schemas.py`) | Status |
|------------------------|----------------------|--------|
| `LogLine` | `LogLine` | ✅ Synced |
| `RowStyle` | `RowStyle` | ✅ Synced |
| `ProcessedCache` | `ProcessedCache` | ✅ Synced |

### API Types

| TypeScript (`types.ts`) | Python (`schemas.py`) | Status |
|------------------------|----------------------|--------|
| - | `FileLoadedPayload` | ⚠️ Frontend uses inline |
| - | `SearchConfig` | ⚠️ Frontend uses inline |
| - | `PlatformInfo` | ⚠️ Frontend uses inline |
| - | `WorkerConfig` | ⚠️ Frontend uses inline |

---

## Detailed Field Mappings

### LayerType / LayerTypeEnum

```typescript
// TypeScript (types.ts:12-23)
enum LayerType {
  FILTER, HIGHLIGHT, RANGE, MARK, TIME_RANGE,
  LEVEL, TRANSFORM, EXTRACT, FOLDER, PYTHON
}
```

```python
# Python (schemas.py:13-24)
class LayerTypeEnum(str, Enum):
    FILTER, HIGHLIGHT, RANGE, MARK, TIME_RANGE,
    LEVEL, TRANSFORM, EXTRACT, FOLDER, PYTHON
```

**Note**: Values are identical strings.

---

### LogLayer

| TypeScript Field | Python Field | Type Match |
|-----------------|--------------|------------|
| `id: string` | `id: str` | ✅ |
| `name: string` | `name: str` | ✅ |
| `type: LayerType` | `type: LayerTypeEnum` | ✅ |
| `enabled: boolean` | `enabled: bool = True` | ✅ |
| `isLocked?: boolean` | `isLocked: Optional[bool]` | ✅ |
| `isCollapsed?: boolean` | `isCollapsed: Optional[bool]` | ✅ |
| `groupId?: string` | `groupId: Optional[str]` | ✅ |
| `config: LayerConfig` | `config: LayerConfig` | ✅ |

---

### LayerConfig

| TypeScript Field | Python Field | Type Match |
|-----------------|--------------|------------|
| `query?: string` | `query: Optional[str]` | ✅ |
| `regex?: boolean` | `regex: Optional[bool]` | ✅ |
| `caseSensitive?: boolean` | `caseSensitive: Optional[bool]` | ✅ |
| `wholeWord?: boolean` | `wholeWord: Optional[bool]` | ✅ |
| `invert?: boolean` | `invert: Optional[bool]` | ✅ |
| `levels?: string[]` | `levels: Optional[List[str]]` | ✅ |
| `color?: string` | `color: Optional[str]` | ✅ |
| `opacity?: number` | `opacity: Optional[float]` | ✅ |
| `[key: string]: any` | `model_config = ConfigDict(extra="allow")` | ✅ Both allow extra fields |

---

### LogLine

| TypeScript Field | Python Field | Type Match |
|-----------------|--------------|------------|
| `index: number` | `index: int` | ✅ |
| `content: string` | `content: str` | ✅ |
| `displayContent?: string` | `displayContent: Optional[str]` | ✅ |
| `highlights?: Array<{start, end, color, opacity, isSearch?}>` | `highlights: Optional[List[Highlight]]` | ✅ |
| `isMarked?: boolean` | `isMarked: Optional[bool]` | ✅ |
| `bookmarkComment?: string` | `bookmarkComment: Optional[str]` | ✅ |
| `rowStyle?: RowStyle` | `rowStyle: Optional[RowStyle]` | ✅ |

---

### RowStyle

| TypeScript Field | Python Field | Type Match |
|-----------------|--------------|------------|
| `backgroundColor?: string` | `backgroundColor: Optional[str]` | ✅ |
| `color?: string` | `color: Optional[str]` | ✅ |

---

## Parameter Naming Convention

API boundary uses different naming conventions:

| Layer | Convention | Example |
|-------|------------|---------|
| TypeScript | camelCase | `fileId`, `lineIndex`, `caseSensitive` |
| Python | snake_case | `file_id`, `line_index`, `case_sensitive` |

**Transformation**: `bridge_client.ts` handles conversion automatically.

---

## Backend-Only Types (core.py)

These types are used internally in Python and don't need TypeScript mirrors:

| Type | Purpose |
|------|---------|
| `LayerStage` | Execution stage (NATIVE, LOGIC, RENDERING) |
| `LayerCategory` | Category (FILTER, TRANSFORM, HIGHLIGHT, DECORATION, WIDGET) |
| `Highlight` (dataclass) | Internal highlight representation |
| `RowStyle` (dataclass) | Internal row styling |
| `ProcessedLine` | Transform layer output |
| `LayerResult` | Pipeline processing result |
| `PipelineContext` | Pipeline execution context |

---

## Frontend-Only Types

These types are used only in frontend and don't need Python mirrors:

| Type | Purpose | Location |
|------|---------|----------|
| `FileBridgeAPI` | Bridge interface | `types.ts:118-185` |
| `ProcessedCache` | Frontend cache state | `types.ts:110-114` |

---

## Sync Checklist

When adding a new shared type:

1. [ ] Add Pydantic model to `backend/loglayer/schemas.py`
2. [ ] Add TypeScript interface to `frontend/src/types.ts`
3. [ ] Add `// Mirror:` comment to TypeScript type
4. [ ] Add `# Mirror:` comment to Python model
5. [ ] Update this TYPE_SYNC.md document
6. [ ] Run CI to verify type counts match

---

## Type Count Verification

Current counts (should match):

| File | Count |
|------|-------|
| `frontend/src/types.ts` | 11 core interfaces |
| `backend/loglayer/schemas.py` | 16 Pydantic models |

**CI Check**: Build fails if counts don't match.

---

*Last updated: 2026-03-20*
*Part of unified-architecture-optimization change*