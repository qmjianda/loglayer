import json

import pytest

from tests.benchmarks.benchmark_guard import (
    DEFAULT_THRESHOLDS,
    BenchmarkResultError,
    BenchmarkThresholds,
    evaluate_thresholds,
    parse_result,
)


def test_parse_result_accepts_valid_json() -> None:
    payload = json.dumps(
        {
            "fixture_size_bytes": 128,
            "line_count": 4,
            "index_duration_seconds": 0.01,
            "search_duration_seconds": 0.02,
        }
    )

    result = parse_result(payload)

    assert result.fixture_size_bytes == 128
    assert result.line_count == 4
    assert result.index_duration_seconds == 0.01
    assert result.search_duration_seconds == 0.02


@pytest.mark.parametrize(
    "payload",
    [
        "not-json",
        json.dumps({"fixture_size_bytes": 128}),
        json.dumps(
            {
                "fixture_size_bytes": -1,
                "line_count": 4,
                "index_duration_seconds": 0.01,
                "search_duration_seconds": 0.02,
            }
        ),
    ],
)
def test_parse_result_rejects_malformed_json(payload: str) -> None:
    with pytest.raises(BenchmarkResultError):
        parse_result(payload)


def test_evaluate_thresholds_reports_index_regression() -> None:
    thresholds = BenchmarkThresholds(index_duration_seconds=1.0, search_duration_seconds=1.0)
    result = parse_result(
        json.dumps(
            {
                "fixture_size_bytes": 128,
                "line_count": 4,
                "index_duration_seconds": 1.01,
                "search_duration_seconds": 0.02,
            }
        )
    )

    failures = evaluate_thresholds(result, thresholds)

    assert failures == ("index_duration_seconds=1.010000s exceeds 1.000000s",)


def test_default_thresholds_are_positive() -> None:
    assert DEFAULT_THRESHOLDS.index_duration_seconds > 0
    assert DEFAULT_THRESHOLDS.search_duration_seconds > 0
