"""验收测试：rg 缺失时 LogLevelStats 降级不崩溃（GitHub issue #1）。

对应 `openspec/changes/fix-rg-fallback-stats/specs/log-level-stats-resilience/spec.md`
的三个 Requirement：
1. rg 不可用时 `_calculate_log_level_stats` 降级 Python 统计，返回真实计数不抛异常
2. `find_rg_binary()` 候选路径失效时回退 PATH，仍无则返回 None
3. `StatsWorker(rg_path=None)` 正常 emit 空结果
"""
import os
import sys
import threading

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bridge import FileBridge
from bridge.workers import StatsWorker
from bridge.utils import find_rg_binary
from loglayer.core import LayerStage


def _write_log(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return path


# ---------------------------------------------------------------
# Requirement 2: find_rg_binary 回退链
# ---------------------------------------------------------------

class TestFindRgBinary:
    def test_returns_existing_candidate(self, tmp_path, monkeypatch):
        """候选目录中存在的 rg 应被优先返回。"""
        import platform as _platform

        platform_dir = "windows" if _platform.system() == "Windows" else "linux"
        exe = "rg.exe" if _platform.system() == "Windows" else "rg"
        fake_bin = tmp_path / platform_dir
        fake_bin.mkdir(parents=True)
        fake_rg = fake_bin / exe
        fake_rg.write_bytes(b"#")
        monkeypatch.setattr("shutil.which", lambda _: None)
        result = find_rg_binary([str(tmp_path)])
        assert result == str(fake_rg)

    def test_falls_back_to_path(self, tmp_path, monkeypatch):
        """候选目录均不存在时回退系统 PATH 的 rg。"""
        fake_rg = tmp_path / "rg"
        fake_rg.write_bytes(b"#")
        monkeypatch.setattr("shutil.which", lambda name: str(fake_rg))
        result = find_rg_binary(["/nonexistent/dir"])
        assert result == str(fake_rg)

    def test_returns_none_when_all_missing(self, monkeypatch):
        """候选目录与 PATH 都没有 rg 时返回 None。"""
        monkeypatch.setattr("shutil.which", lambda name: None)
        result = find_rg_binary(["/nonexistent/dir"])
        assert result is None

    def test_bridge_get_rg_path_returns_none_when_missing(self, monkeypatch):
        """_get_rg_path 在 find_rg_binary 返回 None 时应透传 None（不返回不存在的路径）。"""
        monkeypatch.setattr("bridge.file_bridge.find_rg_binary", lambda dirs: None)
        bridge = FileBridge()
        assert bridge._rg_path is None


# ---------------------------------------------------------------
# Requirement 1: _calculate_log_level_stats Python 降级
# ---------------------------------------------------------------

class TestCalculateLogLevelStatsFallback:
    def test_rg_missing_returns_real_counts(self, tmp_path, monkeypatch):
        """rg 路径不存在时，_calculate_log_level_stats 降级统计并返回真实计数。"""
        log = _write_log(
            tmp_path / "sample.log",
            [
                "2026-01-01 10:00:00 ERROR boom",
                "2026-01-01 10:00:01 INFO ok",
                "2026-01-01 10:00:02 WARN caution",
                "2026-01-01 10:00:03 ERROR again",
                "plain line without level",
            ],
        )
        bridge = FileBridge()
        bridge._rg_path = str(tmp_path / "no-rg-here")
        stats = bridge._calculate_log_level_stats(str(log))
        assert stats["ERROR"] == 2
        assert stats["INFO"] == 1
        assert stats["WARN"] == 1
        assert stats["DEBUG"] == 0

    def test_case_insensitive(self, tmp_path):
        """降级统计大小写不敏感（与 rg -i 行为一致）。"""
        log = _write_log(
            tmp_path / "case.log",
            ["error lowercase", "Error mixed", "ERROR upper", "info"],
        )
        bridge = FileBridge()
        bridge._rg_path = str(tmp_path / "no-rg-here")
        stats = bridge._calculate_log_level_stats(str(log))
        assert stats["ERROR"] == 3
        assert stats["INFO"] == 1


# ---------------------------------------------------------------
# Requirement 3: StatsWorker 兼容 rg_path=None
# ---------------------------------------------------------------

class TestStatsWorkerNoneRg:
    def test_emits_empty_result(self):
        """rg_path=None 时 StatsWorker 不抛异常，emit 空 JSON。"""
        worker = StatsWorker(
            rg_path=None,
            layers=[],
            file_path="/nonexistent/file.log",
            total_lines=10,
            search_config=None,
        )
        result = {}
        done = threading.Event()

        def on_finished(stats_json):
            result["json"] = stats_json
            done.set()

        worker.finished.connect(on_finished)
        worker.start()
        assert done.wait(timeout=5), "StatsWorker 未在超时内完成"
        assert result["json"] == "{}"


# 保留 LayerStage 引用防止误删（StatsWorker 关联图层阶段枚举）
assert LayerStage is not None
