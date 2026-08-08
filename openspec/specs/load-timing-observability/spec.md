# load-timing-observability Specification

## Purpose
TBD - created by archiving change fix-slow-streaming-load. Update Purpose after archive.
## Requirements
### Requirement: Backend emits stage timing logs for file open pipeline

The backend SHALL emit `[Timing]`-prefixed log lines with wall-clock millisecond timestamps for each major stage of the file open pipeline, when the timing switch is enabled. Stages covered SHALL include at minimum: open_file entry, cache lookup, cache-hit branch (offset deserialization / mmap open / bookmark restore / fileLoaded emit), cache-miss branch (mmap open / operationStarted emit / index worker spawn), indexing completion, pipeline cache lookup with hit/miss, pipeline completion, stats calculation (per ripgrep call and total), and processed-lines reads.

#### Scenario: Backend timing enabled, user opens a file
- **WHEN** the environment variable `LOGLAYER_TIMING=1` is set and a file is opened via `POST /api/open_file`
- **THEN** the backend prints `[Timing]` log lines containing the stage name, wall-clock timestamp in ms, and duration in ms
- **AND** the open_file, indexing, pipeline, and stats stages each appear in the log

#### Scenario: Backend timing disabled
- **WHEN** `LOGLAYER_TIMING` is not set to `1` and a file is opened
- **THEN** the backend emits no `[Timing]` output
- **AND** timing measurement adds no measurable overhead on the hot path (no string formatting / perf_counter calls when disabled)

#### Scenario: Cache hit vs cache miss distinguishable
- **WHEN** a file open is served from cache
- **THEN** the timing log for the cache-lookup stage reports `hit=true`
- **AND** when the cache misses, the log reports `hit=false` and includes the indexing stage duration

### Requirement: Frontend emits timing logs for open pipeline state transitions

The frontend SHALL emit `[Timing]`-prefixed console log lines with wall-clock millisecond timestamps at key points of the open pipeline, when the timing switch is enabled. Points covered SHALL include at minimum: loading state start (the moment "正在加载流式日志..." would appear), openFile REST request dispatch, and arrival of the `operationStarted`, `fileLoaded`, `pipelineFinished`, and `statsFinished` WebSocket signals.

#### Scenario: Frontend timing enabled, user opens a file
- **WHEN** the build-time switch `VITE_TIMING=1` is set and the user opens a file
- **THEN** the browser console logs `[Timing]` lines with stage names and wall-clock ms timestamps for loading-start and each WS signal arrival
- **AND** the log lines include the file id and a timestamp comparable with backend logs (wall-clock ms)

#### Scenario: Frontend timing disabled
- **WHEN** `VITE_TIMING` is not `1`
- **THEN** the frontend emits no `[Timing]` console output
- **AND** the instrumentation adds no measurable overhead when disabled

### Requirement: Timing log format is parseable and comparable across processes

Timing log lines SHALL use a consistent machine-parseable format: `[Timing]` prefix, stage name, wall-clock epoch-milliseconds timestamp, file id, and duration in ms where applicable. Frontend and backend timestamps SHALL be comparable (both wall-clock epoch ms) so the full open timeline can be reconstructed from both logs.

#### Scenario: Correlate frontend and backend logs
- **WHEN** both backend and frontend timing are enabled and a file is opened
- **THEN** for the same open, the frontend loading-start timestamp, the backend open_file-entry timestamp, and the frontend fileLoaded-arrival timestamp are all on the same wall-clock ms scale
- **AND** a stage can be ordered relative to the others across the two logs

