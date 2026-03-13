# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

LogLayer is a high-performance desktop log analysis application that handles massive log files (1GB+) with millisecond-level search and visual filtering. Built with Python FastAPI backend + React frontend via pywebview.

---

## Common Commands

### Frontend
```bash
npm run dev           # Development server (port 3000)
npm run build         # Production build
npm run test          # Run Vitest tests
npx tsc --noEmit      # TypeScript type check
```

### Backend
```bash
python backend/main.py    # Start full application
```

### Testing
```bash
pytest tests/              # All tests
pytest tests/unit/         # Unit tests only
pytest tests/integration/  # Integration tests only
pytest tests/test_name.py  # Specific test file
pytest tests/ --cov=backend --cov-report=html  # With coverage
```

### Packaging
```bash
tools/package.bat          # Source bundle (requires Python)
tools/package_exe.bat      # Standalone EXE (requires PyInstaller)
```

---

## Architecture

### System Structure
```
Native OS → mmap → Python Backend (FastAPI) ↔ React Frontend (pywebview)
                  ↓
            Layer Engine → Filter/Highlight/Time/Level/Ranges
                  ↓
            Background Workers → Indexing/Search via ripgrep
```

### Backend Modules
| Module | Responsibility |
|:-------|:---------------|
| `backend/bridge.py` | Core: mmap indexing, file operations, signal handling |
| `backend/main.py` | FastAPI entry point, REST/WS routes, pywebview integration |
| `backend/api_routes.py` | REST API endpoints |
| `backend/websocket_manager.py` | Real-time WebSocket communication |
| `backend/loglayer/core.py` | Unified Layer Engine base classes |
| `backend/loglayer/registry.py` | Layer registration and discovery |
| `backend/loglayer/builtin/` | 10+ built-in layer types (filter, highlight, level, time, etc.) |
| `backend/ai/` | AI service module with cloud/local providers |

### Frontend Modules
| Module | Responsibility |
|:-------|:---------------|
| `frontend/src/components/LogViewer.tsx` | Canvas-based virtual scrolling |
| `frontend/src/bridge_client.ts` | API client for backend communication |
| `frontend/src/components/DynamicUI/` | Schema-driven configuration UI |
| `frontend/src/hooks/` | React hooks (useFileManagement, useLayerManagement, etc.) |
| `frontend/src/contexts/` | React Context providers |

---

## Key Patterns

### Virtual Scrolling
All log viewing MUST use virtual scrolling (O(1) rendering). The `LogViewer.tsx` component uses HTML5 Canvas with viewport-only rendering for consistent 60FPS with millions of lines.

### Layer System
- `sync_layers()` - Data-altering operations (filtering, ranges)
- `sync_decorations()` - Visual-only changes (highlights, row tints)

### Platform Awareness
Use `/api/platform` endpoint for OS-specific logic. Frontend should use the `usePlatformInfo` hook instead of `navigator.platform`.

### Communication Contract
- WebSocket messages in `main.py` must match signal emitters in `bridge_client.ts`
- REST endpoints defined in `api_routes.py`

---

## Important Constants (from frontend)

```typescript
export const LOG_VIEWER = {
  LINE_HEIGHT: 20,
  GUTTER_WIDTH: 80,
  BUFFER_NORMAL: 200,
  BUFFER_LARGE: 500,
  VIRTUAL_HEIGHT_LIMIT: 10_000_000,
  MAX_CACHED_LINES: 5000,
} as const;
```

---

## Code Style

### Python
- 4 spaces indentation, max 100 line length
- snake_case for functions/variables, PascalCase for classes
- Use Pydantic BaseModel for API models
- Imports: stdlib → third-party → local (group: asyncio, threading, uvicorn, fastapi, pydantic, local)

### TypeScript/React
- 2 spaces indentation, single quotes
- camelCase for variables, PascalCase for components
- Functional components with hooks
- Extract custom hooks to `hooks/` folder

---

## Development Workflow

1. Read `docs/PROGRESS.md` and `docs/CONTEXT.md` for current state
2. Make changes in small, focused modules
3. Run type check (`npx tsc --noEmit`) and tests (`pytest`) before committing
4. Update `docs/PROGRESS.md` after completing tasks

---

## Key Documentation Files

| File | Purpose |
|:-----|:--------|
| `docs/CONTEXT.md` | Project context snapshot |
| `docs/PROGRESS.md` | Current development progress |
| `docs/TECHNICAL_DECISIONS.md` | Technical decision records |
| `AGENTS.md` | AI assistant guidelines |
| `PROJECT_MAP.md` | Architecture map and changelog |