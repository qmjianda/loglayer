## Approach

1. Establish removal contracts with static/backend/frontend acceptance tests before deleting implementation.
2. Delete the entire backend AI package and unregister its router; leave ordinary `loglayer.builtin.time_range` parsing and configuration untouched.
3. Remove AI-only frontend modules and thread only non-AI props through `App`, `SidebarView`, `EditorArea`, `LogViewer`, `ContextMenu`, `useContextMenu`, `useUIState`, and `useCommands`.
4. Remove only dependencies proven exclusive to AI (`@google/genai` and any AI-only Python package references); retain FastAPI, Pydantic, request, and performance settings used by ordinary features.
5. Remove Gemini/API-key build injection and update current documentation, excluding changelog/history and the unfinished historical OpenSpec change.

## Boundaries

- No compatibility routes or replacement APIs are added for deleted AI endpoints.
- Timestamp extraction and TIME_RANGE layer behavior are ordinary functionality and are preserved.
- Existing non-AI APIs, copy/highlight/filter/bookmark behavior, and tests are not weakened to make removal pass.

## Verification

The removal acceptance tests cover route/package/configuration absence and preservation of ordinary TIME_RANGE fields/actions. Run them red before implementation, then green, followed by the repository's Python and frontend checks and a static reference audit excluding OpenSpec history/archive.
