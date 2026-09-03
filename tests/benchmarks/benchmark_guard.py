#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

# ─── How to run ───
# 1. Install uv (if not installed):
#      curl -LsSf https://astral.sh/uv/install.sh | sh
# 2. Run directly (no venv or service required):
#      uv run tests/benchmarks/benchmark_guard.py
# ──────────────────

"""Run the small CI performance guard against a deterministic local fixture.

The 1.0-second indexing and 0.5-second search budgets are conservative round
numbers. On the local Linux baseline measured with this command on 2026-08-18,
the same fixture measured 0.0058 and 0.0008 seconds respectively. The guard is
designed to catch order-of-magnitude regressions while tolerating CI variance;
it is not a source of README performance claims.
"""

from __future__ import annotations

import json
import mmap
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Final

BENCHMARK_DIRECTORY: Final = Path(__file__).resolve().parent
if str(BENCHMARK_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(BENCHMARK_DIRECTORY))

from benchmark_indexing import fast_indexing


FIXTURE_LINE_COUNT: Final = 50_000
JsonScalar = int | float | str | bool | None


@dataclass(frozen=True, slots=True)
class BenchmarkThresholds:
    index_duration_seconds: float
    search_duration_seconds: float


@dataclass(frozen=True, slots=True)
class BenchmarkResult:
    fixture_size_bytes: int
    line_count: int
    index_duration_seconds: float
    search_duration_seconds: float


class BenchmarkResultError(ValueError):
    """Raised when benchmark JSON does not match the guard contract."""


DEFAULT_THRESHOLDS: Final = BenchmarkThresholds(
    index_duration_seconds=1.0,
    search_duration_seconds=0.5,
)


def _positive_number(payload: dict[str, JsonScalar], key: str) -> float:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        raise BenchmarkResultError(f"{key} must be a positive number")
    return float(value)


def parse_result(raw_json: str) -> BenchmarkResult:
    """Parse and validate the machine-readable benchmark result."""
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as error:
        raise BenchmarkResultError("benchmark output is not valid JSON") from error

    if not isinstance(payload, dict):
        raise BenchmarkResultError("benchmark output must be a JSON object")
    payload_values: dict[str, JsonScalar] = {}
    for key, value in payload.items():
        if not isinstance(key, str) or not isinstance(value, (str, int, float, bool)) and value is not None:
            raise BenchmarkResultError("benchmark output must contain scalar values")
        payload_values[key] = value

    size = payload_values.get("fixture_size_bytes")
    lines = payload_values.get("line_count")
    if isinstance(size, bool) or not isinstance(size, int) or size <= 0:
        raise BenchmarkResultError("fixture_size_bytes must be a positive integer")
    if isinstance(lines, bool) or not isinstance(lines, int) or lines <= 0:
        raise BenchmarkResultError("line_count must be a positive integer")

    return BenchmarkResult(
        fixture_size_bytes=size,
        line_count=lines,
        index_duration_seconds=_positive_number(payload_values, "index_duration_seconds"),
        search_duration_seconds=_positive_number(payload_values, "search_duration_seconds"),
    )


def evaluate_thresholds(
    result: BenchmarkResult,
    thresholds: BenchmarkThresholds = DEFAULT_THRESHOLDS,
) -> tuple[str, ...]:
    """Return one message for each duration that exceeds its budget."""
    failures: list[str] = []
    if result.index_duration_seconds > thresholds.index_duration_seconds:
        failures.append(
            "index_duration_seconds="
            f"{result.index_duration_seconds:.6f}s exceeds "
            f"{thresholds.index_duration_seconds:.6f}s"
        )
    if result.search_duration_seconds > thresholds.search_duration_seconds:
        failures.append(
            "search_duration_seconds="
            f"{result.search_duration_seconds:.6f}s exceeds "
            f"{thresholds.search_duration_seconds:.6f}s"
        )
    return tuple(failures)


def generate_fixture(path: Path, line_count: int = FIXTURE_LINE_COUNT) -> None:
    """Write a repeatable log fixture with a known number of newline records."""
    with path.open("wb") as fixture:
        for index in range(line_count):
            level = b"ERROR" if index % 10 == 0 else b"INFO"
            fixture.write(f"{index:08d} ".encode() + level + b" deterministic log entry\n")


def run_benchmark() -> BenchmarkResult:
    """Generate the fixture, measure indexing and searching, and return results."""
    with TemporaryDirectory(prefix="loglayer-benchmark-") as directory:
        fixture_path = Path(directory) / "fixture.log"
        generate_fixture(fixture_path)
        fixture_size = fixture_path.stat().st_size
        with fixture_path.open("rb") as fixture:
            with mmap.mmap(fixture.fileno(), 0, access=mmap.ACCESS_READ) as mapped:
                indexed_lines, index_duration = fast_indexing(mapped, fixture_size)
                search_start = time.perf_counter()
                match_count = sum(1 for _ in re.finditer(b"ERROR", mapped))
                search_duration = time.perf_counter() - search_start

        expected_matches = (FIXTURE_LINE_COUNT + 9) // 10
        if indexed_lines != FIXTURE_LINE_COUNT or match_count != expected_matches:
            msg = f"fixture measurements invalid: lines={indexed_lines}, matches={match_count}"
            raise BenchmarkResultError(msg)
        return BenchmarkResult(
            fixture_size_bytes=fixture_size,
            line_count=indexed_lines,
            index_duration_seconds=index_duration,
            search_duration_seconds=search_duration,
        )


def main() -> int:
    """Print one JSON result and return a regression status code."""
    try:
        result = run_benchmark()
    except (BenchmarkResultError, OSError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1

    output = json.dumps(
        {
            "fixture_size_bytes": result.fixture_size_bytes,
            "line_count": result.line_count,
            "index_duration_seconds": result.index_duration_seconds,
            "search_duration_seconds": result.search_duration_seconds,
        },
        sort_keys=True,
    )
    print(output)
    failures = evaluate_thresholds(result)
    if failures:
        print("benchmark regression: " + "; ".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
