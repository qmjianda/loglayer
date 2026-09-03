# LogLayer Benchmarks

This document records reproducible reference measurements. It is not a promise of fixed performance across hardware.

## Reference Environment

- Date: 2026-08-18
- Platform: Linux under WSL2
- Fixture: `large_test.log`, 1,311,409,579 bytes (1,250.66 MiB), 22,919,353 lines
- Commands were run from the repository checkout with the fixture held read-only.

## Results

### mmap Indexing

The functions in `tests/benchmarks/benchmark_indexing.py` were run against the 1.3GB fixture:

| Method | Lines indexed | Duration |
| --- | ---: | ---: |
| `current_indexing` (threaded) | 22,919,353 | 4.265 s |
| `fast_indexing` (`re.finditer`) | 22,919,353 | 2.746 s |
| `regex_all_offsets` | 22,919,353 | 7.466 s |

### ripgrep Search

The bundled Linux ripgrep binary searched the same fixture with line numbers and no color output:

| Query | Duration |
| --- | ---: |
| `ERROR` | 1.015 s |
| `FATAL` | 0.844 s |

## Reproduce

The large fixture is intentionally ignored by Git. Generate one locally when needed:

```bash
python tests/benchmarks/gen_big_file.py tests/logs/large_test.log
python tests/benchmarks/benchmark_indexing.py
```

To run the lightweight CI guard without a service or large fixture:

```bash
python tests/benchmarks/benchmark_guard.py
```

The guard creates a deterministic 50,000-line fixture, emits JSON, and fails when indexing exceeds 1.0 second or searching exceeds 0.5 second. These limits are deliberately broad to catch order-of-magnitude regressions while tolerating CI variance.

## Release Gate

`tests/benchmarks/phase2_gate.py` remains the deeper manual gate. It measures the browser workflow against the 1.3GB fixture, including open, search, scrolling, and jump latency. Run it only on a machine with the required fixture, Playwright/Chromium, both services, and sufficient memory:

```bash
python tests/benchmarks/phase2_gate.py
```

Do not compare results across machines without recording the operating system, CPU, memory, fixture size, and application revision.
