# file-open-performance Specification

## Purpose
TBD - created by archiving change fix-slow-streaming-load. Update Purpose after archive.
## Requirements
### Requirement: Log level stats computed in a single ripgrep pass

The backend SHALL compute counts for all log levels (ERROR, WARN, INFO, DEBUG, TRACE, FATAL) in a **single** ripgrep invocation instead of one subprocess per level. The returned stats JSON SHALL keep the same shape (`{LEVEL: count}`).

#### Scenario: Stats requested for a file
- **WHEN** the backend receives a log-level stats request for a file
- **THEN** it runs exactly one ripgrep subprocess that extracts level keywords and counts them
- **AND** the returned JSON contains all six levels with correct counts

#### Scenario: Stats match single-level results
- **WHEN** a file contains known counts of each log level
- **THEN** the single-pass result matches what six separate per-level ripgrep calls would return
- **AND** the total stats computation time is substantially lower than the previous per-level loop (single process startup + one file scan)

#### Scenario: File has no matching levels
- **WHEN** the file contains no recognized log level keywords
- **THEN** all six counts are 0 and the request completes quickly

### Requirement: Stats are not fetched before file indexing completes

The frontend SHALL NOT fetch log-level stats for a file until the `fileLoaded` signal for that file has been received. Stats SHALL be fetched exactly once per file activation.

#### Scenario: User opens a file (first time, no cache)
- **WHEN** a user opens a file that must be indexed
- **THEN** the frontend does not issue a stats request while indexing is in progress
- **AND** a single stats request is issued after the `fileLoaded` signal arrives

#### Scenario: Stats request count on open
- **WHEN** a user opens a file
- **THEN** exactly one `getLogLevelStats` request is issued per file activation (not two), observable via timing logs

### Requirement: WebSocket signal callbacks registered exactly once

Each backend WebSocket signal (fileLoaded, operationStarted, pipelineFinished, statsFinished) SHALL trigger exactly one frontend callback per emission. The frontend SHALL guard against duplicate signal registration.

#### Scenario: Signal emitted by backend
- **WHEN** the backend emits a fileLoaded / operationStarted / pipelineFinished / statsFinished signal
- **THEN** the frontend callback for that signal executes exactly once
- **AND** timing logs show a single `signal.*` entry per backend emission (previously duplicated)

### Requirement: Cache-hit open reuses stored file hash

The metadata cache SHALL avoid recomputing the file hash on every cache lookup when the file size is unchanged. A cache hit path SHALL compare the current file size against the stored record size, and only recompute the hash when sizes differ.

#### Scenario: Cache hit with unchanged file
- **WHEN** a previously-indexed file is opened again and its size is unchanged
- **THEN** the cache lookup returns the cached offsets without recomputing the SHA-256 file hash
- **AND** the `open_file.cache_lookup` timing drops to milliseconds for large files

#### Scenario: File modified after caching
- **WHEN** a cached file's content changes (size changes)
- **THEN** the cache lookup detects the size mismatch, recomputes the hash, and falls back to re-indexing (cache invalidated correctly)

