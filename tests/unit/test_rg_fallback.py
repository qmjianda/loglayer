"""验收测试：rg 缺失时行为收敛（issue #1 根因修复）。

对应 `openspec/changes/fix-rg-packaging/specs/`：
- `offline-packaging-rg`: find_rg_binary 回退链 + POSIX 可执行性自检（chmod 补齐）
- `log-level-stats-resilience`: stats 缺 rg 返回全 0 + 告警（不做 Python 慢速替代）；
  搜索缺 rg 空结果 + 告警；StatsWorker rg=None 正常 emit
"""
import os
import sys
import threading

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bridge import FileBridge
from bridge.search_matching import compute_search_matches
from bridge.workers import StatsWorker
from bridge.utils import find_rg_binary
from loglayer.core import LayerStage


def _write_log(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return path


# ---------------------------------------------------------------
# find_rg_binary 回退链
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


# ---------------------------------------------------------------
# find_rg_binary POSIX 可执行性自检（chmod 补齐）
# ---------------------------------------------------------------

@pytest.mark.skipif(os.name == "nt", reason="Windows 无执行位概念")
class TestFindRgBinaryExecutable:
    def _make_candidate(self, tmp_path):
        import platform as _platform

        fake_bin = tmp_path / "linux"
        fake_bin.mkdir(parents=True)
        fake_rg = fake_bin / "rg"
        fake_rg.write_bytes(b"#")
        return fake_rg

    def test_chmod_fixes_missing_exec_bit(self, tmp_path, monkeypatch):
        """候选 rg 缺执行位时 chmod 补齐后返回。"""
        fake_rg = self._make_candidate(tmp_path)
        monkeypatch.setattr("shutil.which", lambda _: None)
        monkeypatch.setattr("os.access", lambda path, mode: False)
        chmod_calls = []
        monkeypatch.setattr("os.chmod", lambda path, mode: chmod_calls.append(path))
        result = find_rg_binary([str(tmp_path)])
        assert result == str(fake_rg)
        assert chmod_calls == [str(fake_rg)], "应对缺失执行位的候选执行 chmod"

    def test_chmod_failure_falls_back(self, tmp_path, monkeypatch):
        """chmod 失败时放弃该候选，回退链继续（最终 None）。"""
        fake_rg = self._make_candidate(tmp_path)
        monkeypatch.setattr("shutil.which", lambda _: None)
        monkeypatch.setattr("os.access", lambda path, mode: False)

        def raise_oserror(path, mode):
            raise OSError("read-only fs")

        monkeypatch.setattr("os.chmod", raise_oserror)
        result = find_rg_binary([str(tmp_path)])
        assert result is None


# ---------------------------------------------------------------
# _get_rg_path 透传 None
# ---------------------------------------------------------------

class TestBridgeGetRgPath:
    def test_bridge_get_rg_path_returns_none_when_missing(self, monkeypatch):
        """_get_rg_path 在 find_rg_binary 返回 None 时应透传 None（不返回不存在的路径）。"""
        monkeypatch.setattr("bridge.file_bridge.find_rg_binary", lambda dirs: None)
        bridge = FileBridge()
        assert bridge._rg_path is None


# ---------------------------------------------------------------
# stats 缺 rg：返回全 0 + 告警，不做 Python 慢速替代
# ---------------------------------------------------------------

class TestCalculateLogLevelStatsMissingRg:
    def test_rg_missing_returns_all_zero_and_warns(self, tmp_path, capsys):
        """rg 路径不存在时 stats 返回全 0 并打印 [LogLevelStats] 告警，不抛异常。"""
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
        assert stats["ERROR"] == 0
        assert stats["INFO"] == 0
        assert stats["WARN"] == 0
        assert stats["DEBUG"] == 0
        assert "[LogLevelStats]" in capsys.readouterr().out

    def test_no_python_fallback_engine(self):
        """不应存在 Python 逐行统计替代引擎（性能红线：大文件同步逐行读）。"""
        assert not hasattr(FileBridge, "_python_level_stats")


# ---------------------------------------------------------------
# 搜索缺 rg：空结果 + 明确告警（不静默）
# ---------------------------------------------------------------

class TestComputeSearchMatchesMissingRg:
    def test_returns_empty_and_warns(self, capsys):
        """rg_path=None 时搜索返回空数组并打印 [Search] 告警。"""
        matches = compute_search_matches(
            rg_path=None,
            file_path="/nonexistent/file.log",
            search_config={"query": "error", "regex": False, "caseSensitive": False},
        )
        assert len(matches) == 0
        out = capsys.readouterr().out
        assert "[Search]" in out and "rg unavailable" in out

    def test_no_query_returns_empty_silently(self, capsys):
        """无搜索词时返回空且不告警（正常路径）。"""
        matches = compute_search_matches(
            rg_path=None,
            file_path="/nonexistent/file.log",
            search_config=None,
        )
        assert len(matches) == 0
        assert capsys.readouterr().out == ""


# ---------------------------------------------------------------
# StatsWorker 兼容 rg_path=None
# ---------------------------------------------------------------

class TestStatsWorkerNoneRg:
    def test_emits_empty_result(self, capsys):
        """rg_path=None 时 StatsWorker 不抛异常，emit 空 JSON 并告警。"""
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
        assert "[Stats]" in capsys.readouterr().out


# 保留 LayerStage 引用防止误删（StatsWorker 关联图层阶段枚举）
assert LayerStage is not None
