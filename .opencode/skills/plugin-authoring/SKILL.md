# LogLayer Plugin Authoring

Use this skill when creating, migrating, testing, or packaging a LogLayer plugin.

## Workflow

1. Identify one capability: `FILTER`, `TRANSFORM`, `RENDERING`, or `UIWidget`.
2. Confirm the API version, plugin id, dependencies, and required fixed UI slot.
3. Generate `loglayer.plugin.json`, the Python entry module, and acceptance tests.
4. Register through `RegistryFacade`; never mutate a global registry directly.
5. Validate manifest fields, API compatibility, discovery, duplicate IDs, failure isolation,
   and the declared behavior before reporting success.
6. Explain either `pip install -e .` / wheel installation or the EXE sibling `plugins/`
   directory installation path.

## Contract

The external manifest filename is `loglayer.plugin.json` and the installed entry-point
group is `loglayer.plugins`. A manifest declares `id`, `name`, `version`, `api`, `entry`,
and `capabilities`. UI widgets use only `sidebar`, `inspector`, `statusbar`, or
`editor_toolbar`.

`FILTER` and `TRANSFORM` execute in the backend pipeline. `RENDERING` only references an
application-bundled static renderer. `UIWidget` returns declaration data for a fixed slot.

## Hard Boundaries

- Do not generate arbitrary React, JavaScript, remote modules, routes, or DOM injection.
- Do not claim that Pluggy, a manifest, or PyInstaller provides a sandbox or permissions.
- Do not bypass the registry facade or hide import side effects in generated code.
- Do not report completion when a required test or validation step fails.

External plugins are trusted in-process Python code. Tell users to review source and
dependencies. Untrusted code requires a separate process or operating-system isolation,
which is outside this skill and the current plugin system.
