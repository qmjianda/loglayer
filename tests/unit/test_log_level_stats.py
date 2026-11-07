"""文件级日志级别统计验收测试（log-level-stats）。

对应 spec：
- log-level-stats → 按行计数与级别优先级 / 统计缓存与失效 / 并发统计请求去重 /
  统计缓存可观测与可清理
- log-level-stats-resilience → rg 缺失时返回全 0 并告警（回归）

任务：1.1 / 1.2 / 1.3 / 1.4
"""

import os
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import bridge.file_bridge as file_bridge_module
from bridge import FileBridge

ZERO_KEYS = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE", "FATAL"]


def _write_log(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        for line in lines:
            f.write(line + "\n")
    return path


@pytest.fixture
def stats_bridge(rg_path):
    """指向真实 rg 的干净 FileBridge（每个测试独立缓存）。"""
    bridge = FileBridge()
    bridge._rg_path = rg_path
    return bridge


# ---------------------------------------------------------------------------
# 1.1 按行计口径
# ---------------------------------------------------------------------------


def test_duplicate_token_counts_once(stats_bridge, tmp_path):
    """同一行重复出现 ERROR 只计 1。"""
    log = _write_log(
        tmp_path / "dup.log",
        [
            "ERROR ERROR something failed",
            "INFO ok",
        ],
    )
    stats = stats_bridge._calculate_log_level_stats(str(log))
    assert stats["ERROR"] == 1, f"重复 token 不应重复计数: {stats}"
    assert stats["INFO"] == 1


def test_multi_level_line_uses_highest_priority(stats_bridge, tmp_path):
    """一行同时含 WARN 与 ERROR 时只归入 ERROR。"""
    log = _write_log(
        tmp_path / "multi.log",
        [
            "WARN then ERROR in same line",
            "WARN only",
        ],
    )
    stats = stats_bridge._calculate_log_level_stats(str(log))
    assert stats["ERROR"] == 1, f"应归入最高优先级 ERROR: {stats}"
    assert stats["WARN"] == 1, f"仅 WARN-only 行计入 WARN: {stats}"


def test_fatal_beats_error(stats_bridge, tmp_path):
    """FATAL 优先级高于 ERROR。"""
    log = _write_log(tmp_path / "fatal.log", ["ERROR then FATAL crash"])
    stats = stats_bridge._calculate_log_level_stats(str(log))
    assert stats["FATAL"] == 1
    assert stats["ERROR"] == 0


def test_case_insensitive(stats_bridge, tmp_path):
    """大小写不敏感。"""
    log = _write_log(
        tmp_path / "case.log",
        ["error lower", "Error mixed", "eRrOr weird"],
    )
    stats = stats_bridge._calculate_log_level_stats(str(log))
    assert stats["ERROR"] == 3


def test_sum_equals_lines_with_level(stats_bridge, tmp_path):
    """各级别计数之和等于包含级别 token 的行数。"""
    log = _write_log(
        tmp_path / "sum.log",
        [
            "ERROR a",
            "plain line",
            "WARN b",
            "INFO INFO c",
            "no level here",
        ],
    )
    stats = stats_bridge._calculate_log_level_stats(str(log))
    assert sum(stats.values()) == 3, f"应为 3 行含级别: {stats}"
    assert set(stats.keys()) == set(ZERO_KEYS)


# ---------------------------------------------------------------------------
# 1.2 缓存与失效
# ---------------------------------------------------------------------------


def _spy_rg(monkeypatch):
    """包装 subprocess.run，统计真实 rg 调用次数。"""
    calls = []
    real_run = subprocess.run

    def fake_run(*args, **kwargs):
        calls.append(args)
        return real_run(*args, **kwargs)

    monkeypatch.setattr(file_bridge_module.subprocess, "run", fake_run)
    return calls


def test_cache_hit_skips_rescan(stats_bridge, tmp_path, monkeypatch):
    """同一文件连续两次统计只扫描一次。"""
    log = _write_log(tmp_path / "cache.log", ["ERROR one", "INFO two"])
    calls = _spy_rg(monkeypatch)

    first = stats_bridge._calculate_log_level_stats(str(log))
    second = stats_bridge._calculate_log_level_stats(str(log))

    assert first == second
    assert len(calls) == 1, f"第二次应命中缓存，实际 rg 调用 {len(calls)} 次"


def test_size_change_invalidates_cache(stats_bridge, tmp_path, monkeypatch):
    """文件追加内容后缓存失效并重新统计。"""
    log = _write_log(tmp_path / "grow.log", ["ERROR one"])
    calls = _spy_rg(monkeypatch)
    assert stats_bridge._calculate_log_level_stats(str(log))["ERROR"] == 1

    with open(log, "a", encoding="utf-8") as f:
        f.write("ERROR two\n")

    stats = stats_bridge._calculate_log_level_stats(str(log))
    assert stats["ERROR"] == 2
    assert len(calls) == 2, "文件变化后应重新扫描"


def test_mtime_change_invalidates_cache(stats_bridge, tmp_path, monkeypatch):
    """同大小但 mtime 变化时缓存失效。"""
    log = _write_log(tmp_path / "mtime.log", ["ERROR one"])
    calls = _spy_rg(monkeypatch)
    stats_bridge._calculate_log_level_stats(str(log))

    st = os.stat(log)
    os.utime(log, ns=(st.st_atime_ns, st.st_mtime_ns + 1_000_000_000))

    stats_bridge._calculate_log_level_stats(str(log))
    assert len(calls) == 2, "mtime 变化后应重新扫描"


def test_cache_is_lru_bounded(stats_bridge, tmp_path, monkeypatch):
    """超过上限时淘汰最久未使用的条目。"""
    stats_bridge._stats_cache_limit = 2
    calls = _spy_rg(monkeypatch)
    paths = [
        _write_log(tmp_path / f"lru-{i}.log", [f"ERROR {i}"]) for i in range(3)
    ]

    for path in paths:
        stats_bridge._calculate_log_level_stats(str(path))
    assert len(stats_bridge._stats_cache) == 2

    # 最早的条目已被淘汰 → 再次请求会重新扫描
    before = len(calls)
    stats_bridge._calculate_log_level_stats(str(paths[0]))
    assert len(calls) == before + 1, "LRU 应淘汰最早写入的条目"


def test_invalidate_stats_clears_entries(stats_bridge, tmp_path, monkeypatch):
    """invalidate_stats(path) 只清理指定文件。"""
    log_a = _write_log(tmp_path / "inv-a.log", ["ERROR a"])
    log_b = _write_log(tmp_path / "inv-b.log", ["ERROR b"])
    calls = _spy_rg(monkeypatch)
    stats_bridge._calculate_log_level_stats(str(log_a))
    stats_bridge._calculate_log_level_stats(str(log_b))
    assert len(calls) == 2

    stats_bridge.invalidate_stats(str(log_a))
    assert len(stats_bridge._stats_cache) == 1

    stats_bridge._calculate_log_level_stats(str(log_b))
    assert len(calls) == 2, "未失效文件应命中缓存"
    stats_bridge._calculate_log_level_stats(str(log_a))
    assert len(calls) == 3, "已失效文件应重新扫描"


# ---------------------------------------------------------------------------
# 1.3 并发去重
# ---------------------------------------------------------------------------


def test_concurrent_requests_scan_once(stats_bridge, tmp_path, monkeypatch):
    """同一文件 5 个并发请求只执行一次扫描。"""
    log = _write_log(tmp_path / "concurrent.log", ["ERROR one", "WARN two"])
    counter = {"n": 0}
    real_scan = stats_bridge._scan_log_level_stats

    def slow_scan(path):
        counter["n"] += 1
        time.sleep(0.2)
        return real_scan(path)

    monkeypatch.setattr(stats_bridge, "_scan_log_level_stats", slow_scan)

    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(
            ex.map(
                lambda _: stats_bridge._calculate_log_level_stats(str(log)),
                range(5),
            )
        )

    assert counter["n"] == 1, f"并发应只扫描一次，实际 {counter['n']} 次"
    assert all(r == results[0] for r in results)


def test_different_files_scan_in_parallel(stats_bridge, tmp_path, monkeypatch):
    """A 扫描被阻塞时，B 的扫描仍可完成（不同 key 不互相阻塞）。"""
    log_a = _write_log(tmp_path / "par-a.log", ["ERROR a"])
    log_b = _write_log(tmp_path / "par-b.log", ["ERROR b"])
    gate = threading.Event()
    started = threading.Event()
    real_scan = stats_bridge._scan_log_level_stats

    def fake_scan(path):
        if path.endswith("par-a.log"):
            started.set()
            gate.wait(timeout=5)
            return {key: 0 for key in ZERO_KEYS}
        return real_scan(path)

    monkeypatch.setattr(stats_bridge, "_scan_log_level_stats", fake_scan)

    with ThreadPoolExecutor(max_workers=2) as ex:
        future_a = ex.submit(stats_bridge._calculate_log_level_stats, str(log_a))
        assert started.wait(timeout=2), "A 扫描应已开始"
        future_b = ex.submit(stats_bridge._calculate_log_level_stats, str(log_b))
        # B 不等待 A：必须在 A 释放前返回
        result_b = future_b.result(timeout=2)
        gate.set()
        future_a.result(timeout=5)

    assert result_b["ERROR"] == 1


# ---------------------------------------------------------------------------
# 1.4 rg 缺失回归 + 诊断
# ---------------------------------------------------------------------------


def test_rg_missing_returns_zero_and_warns(tmp_path, capsys):
    """rg 不可用时返回全 0 并告警，不缓存错误结果。"""
    log = _write_log(tmp_path / "no-rg.log", ["ERROR boom"])
    bridge = FileBridge()
    bridge._rg_path = str(tmp_path / "no-such-rg")

    stats = bridge._calculate_log_level_stats(str(log))
    assert all(stats[key] == 0 for key in ZERO_KEYS)
    assert "[LogLevelStats]" in capsys.readouterr().out
    assert len(bridge._stats_cache) == 0, "rg 缺失时不应写入缓存"


def test_diagnostics_expose_stats_cache_metrics(stats_bridge, tmp_path):
    """诊断接口暴露统计缓存 hit/miss。"""
    import json

    log = _write_log(tmp_path / "diag.log", ["ERROR one"])
    stats_bridge._calculate_log_level_stats(str(log))
    stats_bridge._calculate_log_level_stats(str(log))

    diag = json.loads(stats_bridge.get_diagnostics())
    assert "stats_cache" in diag
    assert diag["stats_cache"]["miss"] == 1
    assert diag["stats_cache"]["hit"] == 1
    assert diag["stats_cache"]["entries"] == 1
