# Tasks: standardize-plugin-system

## 1. Contract and Specification Review

### 1.1 Contract Baseline

- [x] 1.1.1 Review `proposal.md`, `design.md`, and all eight completed specs; record the requirement-to-test map in the implementation notes before code changes
- [x] 1.1.2 Confirm the fixed contract values in `backend/loglayer/plugin_contract.py` design notes: capability types, API version source, manifest fields, widget slots, renderer IDs, diagnostic stages, and plugin states
- [x] 1.1.3 Confirm the explicit non-goals in the implementation checklist: no arbitrary `.py` discovery for new plugins, no arbitrary React or TypeScript loading, and no process sandbox or permission model

### 1.2 ATDD Red Checkpoint

- [x] 1.2.1 Add backend acceptance test files under `tests/unit/` for manifest validation, API compatibility, Hook isolation, deterministic duplicate handling, registry atomicity, discovery sources, legacy adaptation, path resolution, reload, and layer execution boundaries
- [x] 1.2.2 Add backend integration tests under `tests/integration/` for a real `loglayer.plugins` entry point, declaration-only REST metadata, and an external plugin loaded from a temporary directory
- [x] 1.2.3 Add frontend tests under `frontend/src/**/__tests__/` or the existing frontend test location for every fixed slot, unknown slot, unknown renderer, renderer isolation, and the absence of dynamic plugin React loading
- [x] 1.2.4 Add an E2E test under `tests/e2e/` that loads an external Filter or Transform and observes processed output, plus an E2E test that proves an unknown renderer does not download or execute plugin React code
- [x] 1.2.5 Run the new unit and integration tests and confirm the expected red checkpoint caused by missing implementation before production code

## 2. Backend Plugin Contract and Discovery

### 2.1 Contract and Hook Protocol

- [x] 2.1.1 Add `pluggy` to the backend dependency manifest and add `backend/loglayer/plugin_contract.py` with typed manifest, capability, widget slot, renderer metadata, compatibility, diagnostic, and plugin state models; make the manifest tests pass
- [x] 2.1.2 Add `backend/loglayer/plugin_hooks.py` with the `loglayer` `PluginManager`, one `register(registry, manifest)` hookspec, and the hook implementation boundary; make successful Hook registration and Hook exception isolation tests pass
- [x] 2.1.3 Enforce manifest-first loading, PEP 440 API range checks, declared capability subsets, trusted in-process execution documentation, and stable diagnostic error codes; make incomplete and incompatible manifest tests pass

### 2.2 Discovery and Loading

- [x] 2.2.1 Add `backend/loglayer/plugin_discovery.py` to discover only `importlib.metadata` entry points in `loglayer.plugins`, sort candidates deterministically, normalize and deduplicate paths, and continue after candidate failures; make entry point and ordering tests pass
- [x] 2.2.2 Add `backend/loglayer/plugin_loader.py` to load manifest-backed external packages and modules without scanning unrelated files, use unique module names derived from canonical paths, and isolate import failures; make external loading tests pass
- [x] 2.2.3 Remove the legacy loose-file scanner (`LegacyPluginAdapter`), the AST pre-scan, and frozen `PYTHON_*/WIDGET_*` IDs so discovery accepts only manifests and entry points; assert legacy base-class symbols no longer exist
- [x] 2.2.4 Integrate discovery, manifest validation, Hook execution, and diagnostics into the application startup and explicit reload path through `backend/bridge/file_bridge.py` and the relevant `backend/main.py` initialization seam; make continuation-after-failure tests pass

## 3. Registry Compatibility and Layer Execution

### 3.1 Registry Facade

- [x] 3.1.1 Refactor `backend/loglayer/registry.py` behind a `RegistryFacade` while preserving existing `LayerRegistry` queries, built-in registrations, return fields, and compatibility aliases; make existing registry regression tests pass
- [x] 3.1.2 Implement staging registration for FILTER, TRANSFORM, RENDERING, and UIWidget records with stable namespaced IDs, metadata, factories or legacy adapters, derived engine, UI schema, slot, and renderer ID; make standard layer and widget registration tests pass
- [x] 3.1.3 Enforce deterministic duplicate plugin and capability ID handling, reject unknown types and invalid metadata, discard only invalid capabilities, and atomically commit valid staging records without partial overwrite; make duplicate and atomicity tests pass
- [x] 3.1.4 Expose declaration-only layer and widget metadata through the existing `get_layer_registry` API and `get_ui_widgets` endpoint; make REST JSON shape and failed-plugin diagnostic tests pass

### 3.2 Existing Pipeline Semantics

- [x] 3.2.1 Update `backend/bridge/file_bridge.py` and related pipeline seams so standard FILTER and TRANSFORM factories enter the existing backend pipeline, while RENDERING remains frontend-only and never calls backend visual methods; make layer execution boundary tests pass
- [x] 3.2.2 Register built-in layers through the shared records model (`plugin_id="builtin"`), reject external capabilities that collide with builtin IDs, and delete the deprecated `DataProcessingLayer`/`BaseLayer`/`NativeLayer`/`PluginLayer` aliases; make unified registration and removal tests pass
- [x] 3.2.3 Preserve `derive_engine(category, stage)`, `PipelineWorker`, `sync_layers()`, `sync_decorations()`, session layer instance separation, and ripgrep selection semantics; make the modified layer-system-v2 acceptance tests pass

## 4. External and Frozen Plugin Loading

### 4.1 Paths, Sources, and Reload

- [x] 4.1.1 Add an injectable path resolver for configured development directories, EXE sibling `plugins/`, and user plugin directories; resolve canonical absolute paths without using `os.getcwd()` and make precedence, deduplication, missing directory, and fake executable tests pass
- [x] 4.1.2 Wire source precedence and conflict diagnostics so user, application, configured external, and installed entry point sources produce repeatable results and duplicate plugin IDs select the defined winner; make conflict tests pass
- [x] 4.1.3 Implement explicit staging reload that clears only this run's external module names, replaces external records atomically, removes stale capabilities, preserves built-ins, rebuilds affected instances, and resynchronizes open sessions; make reload success and stale-record tests pass
- [x] 4.1.4 Handle failed reloads by removing or disabling only the failed plugin, retaining other plugins and original session configuration, and returning structured failure reasons; make reload failure isolation tests pass

### 4.2 Packaging Integration

- [x] 4.2.1 Update `tools/package_offline.py` and `LogLayer.spec` to preserve the onedir sibling `plugins/` convention without bundling user plugins, while retaining both platform ripgrep binaries and existing package resource behavior
- [x] 4.2.2 Verify frozen startup tolerates a missing sibling `plugins/` directory and still loads built-ins from any current working directory; make frozen path startup tests pass
- [x] 4.2.3 Preserve runtime ripgrep platform selection, POSIX execute-bit self-check and graceful degradation, and the absence of `LogLayer.bat` and `LogLayer.sh`; make offline packaging regression tests pass, including the case where rg self-check fails but plugin discovery continues

## 5. Frontend Fixed Plugin Slots

### 5.1 Typed Metadata and Routing

- [x] 5.1.1 Add typed `WidgetMetadata` parsing and exhaustive slot routing in the frontend metadata boundary, accepting only `sidebar`, `inspector`, `statusbar`, and `editor_toolbar`; make fixed-slot and unknown-slot tests pass
- [x] 5.1.2 Connect widget metadata consumption to `SidebarView`, `InspectorDock`, `StatusBar`, and `EditorToolbar` without exposing Python factories or plugin source to the browser; make valid metadata rendering tests pass
- [x] 5.1.3 Extend the static renderer contract in `frontend/src/rendering/registry.ts` and reuse `renderWithIsolation()` so unknown renderer IDs skip only that widget and renderer exceptions produce widget-local no-op behavior; make renderer error isolation tests pass
- [x] 5.1.4 Keep frontend loading limited to application-bundled static renderers and declarative config; add a regression assertion that no plugin directory, manifest, network response, or runtime path can dynamically import React code, and make the fixed boundary E2E test pass

### 5.2 Layer-System Integration

- [x] 5.2.1 Consume plugin rendering metadata through the existing static layer renderer registry and preserve frontend execution for RENDERING, while leaving backend FILTER and TRANSFORM behavior unchanged; make layer-system-v2 frontend acceptance tests pass
- [x] 5.2.2 Document and test that a new unique visual renderer requires an application registry change first, followed by a stable manifest renderer ID, rather than runtime plugin code loading; make the static renderer contract test pass

## 6. Plugin Authoring Skill, Templates, and Documentation

### 6.1 Authoring Assets

- [x] 6.1.1 Add the plugin authoring guide under `docs/` covering manifest fields, capability declarations, entry point installation, external directory layout, API compatibility, legacy migration, fixed UI slots, static renderer rules, deterministic validation, and trusted in-process Python limits; make documentation link and example checks pass
- [x] 6.1.2 Add a minimal package template and external-directory template with `loglayer.plugin.json`, entry module, Hook registration, one capability, install instructions, source layout, and acceptance-test skeleton; make template validation tests pass
- [x] 6.1.3 Add the `plugin-authoring` skill under the project skill directory, requiring capability and slot questions, manifest and source generation, installation or external-loading instructions, and acceptance tests for manifest, discovery, duplicate IDs, failures, compatibility, and declared behavior; make skill structure checks pass
- [x] 6.1.4 Make the skill reject arbitrary React loading and avoid sandbox promises, hidden import side effects, registry bypasses, and incomplete-success claims; make the workflow boundary tests pass

### 6.2 Sample Workflow

- [x] 6.2.1 Rewrite the sample plugin as a standard manifest plugin under `examples/plugins/demo-plugin/`, load it through external-directory discovery, and verify its declared capabilities and acceptance tests
- [x] 6.2.2 Update docs and packaging so `backend/plugins/` is removed, the dev default external directory points at `examples/plugins/`, and the EXE bundle ships the manifest-format demo plugin

## 7. Verification and Quality Gates

### 7.1 Acceptance and Regression Verification

- [x] 7.1.1 Run all new unit and integration tests with `python3 -m pytest tests/unit tests/integration` and confirm every requirement scenario is covered by a machine-observable assertion
- [x] 7.1.2 Run frontend type checks, lint, targeted formatting checks, and frontend tests; the repository-wide format check reports only the pre-existing untouched `frontend/src/bridge_client.ts`
- [x] 7.1.3 Run the complete E2E suite with `npm run e2e`, including external plugin loading and fixed renderer boundary scenarios; confirm no test depends on the current working directory or real user/plugin directories
- [x] 7.1.4 Run backend quality gates with `ruff check backend tests` and the repository full pytest command; confirm compatibility, reload, packaging, and ripgrep regressions remain green

### 7.2 OpenSpec Completion

- [x] 7.2.1 Run `openspec-cn validate standardize-plugin-system --strict` and resolve every validation error without editing the completed proposal, design, or specs
- [x] 7.2.2 Review the final diff to confirm only files required by this change are modified, all task checkboxes reflect completed tests and implementation, and arbitrary React loading and sandboxing remain explicitly out of scope
