"""bridge 包拆分冒烟测试（refactor-bridge-module 任务 4.1）。

验证结构正确性（子模块可导入、门面导出完整、纯函数可直接调用），
行为等价性由既有 112 个测试覆盖。
"""
import json
import os
import sys
import array

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

# 各子模块可独立导入且无循环依赖
from bridge import cache as cache_module
from bridge import signal as signal_module
from bridge import utils as utils_module
from bridge import search_matching as search_matching_module
from bridge import workers as workers_module
from bridge import session as session_module
from bridge import file_bridge as file_bridge_module

import bridge


def test_submodules_importable():
    """每个子模块可独立导入，无循环依赖。"""
    assert cache_module.LRUCache is not None
    assert signal_module.Signal is not None
    assert utils_module.resolve_file_path is not None
    assert search_matching_module.compute_search_matches is not None
    assert workers_module.CustomThread is not None
    assert workers_module.PipelineWorker is not None
    assert session_module.LogSession is not None
    assert file_bridge_module.FileBridge is not None


def test_facade_exports_complete():
    """门面（__init__）导出全部公共符号。"""
    expected = [
        "FileBridge",
        "LogSession",
        "Signal",
        "LRUCache",
        "CustomThread",
        "IndexingWorker",
        "PipelineWorker",
        "StatsWorker",
        "compute_search_matches",
        "resolve_file_path",
        "get_directory_contents",
        "get_log_files_recursive",
        "get_creationflags",
        "timing",
        "timing_start",
        "PROCESS_CLEANUP_TIMEOUT",
        "TIMING_ENABLED",
    ]
    for name in expected:
        assert hasattr(bridge, name), f"门面缺失导出: {name}"


def test_facade_symbol_identity():
    """门面导出的符号与子模块定义是同一对象（非重复定义）。"""
    assert bridge.FileBridge is file_bridge_module.FileBridge
    assert bridge.LogSession is session_module.LogSession
    assert bridge.Signal is signal_module.Signal
    assert bridge.LRUCache is cache_module.LRUCache
    assert bridge.compute_search_matches is search_matching_module.compute_search_matches
    assert bridge.resolve_file_path is utils_module.resolve_file_path


def test_compute_search_matches_empty_config():
    """纯函数空配置直接返回空数组（不依赖 rg 二进制）。"""
    result = bridge.compute_search_matches("rg", "nofile.log", None)
    assert isinstance(result, array.array)
    assert len(result) == 0


def test_file_bridge_constructible():
    """FileBridge 可实例化，Mixin 组合完整。"""
    fb = bridge.FileBridge()
    assert fb._sessions == {}
    # Mixin 提供的方法存在
    assert hasattr(fb, "search_ripgrep")
    assert hasattr(fb, "toggle_bookmark")
    assert hasattr(fb, "open_file")


def test_lru_cache_roundtrip():
    """LRUCache 基础读写。"""
    c = bridge.LRUCache(max_size=3)
    c["a"] = 1
    c["b"] = 2
    assert c["a"] == 1
    assert len(c) == 2
    assert sorted(dict(c.items()).keys()) == ["a", "b"]


def test_signal_emit_callback():
    """Signal 发射调用回调，异常被隔离。"""
    s = bridge.Signal(str)
    received = []
    s.connect(lambda x: received.append(x))
    s.emit("hello")
    assert received == ["hello"]


def test_utils_functions_available():
    """utils 工具函数可调用（不触发系统调用）。"""
    assert utils_module.get_creationflags() == 0  # Linux 平台


def test_remove_workspace_file_deletes_entry(tmp_path):
    """remove_workspace_file 删除后 get_files 不含该路径。"""
    from bridge import FileBridge

    bridge = FileBridge()
    path = str(tmp_path / "hist.log")
    bridge.set_workspace_dir(str(tmp_path))
    bridge.set_workspace_files(
        str(tmp_path),
        [{"path": path, "name": "hist.log", "size": 1, "layers": [], "wasOpen": False}],
    )
    assert bridge.remove_workspace_file(str(tmp_path), path) is True
    paths = [f["path"] for f in bridge.get_workspace_files(str(tmp_path))]
    assert path not in paths
