"""搜索模式一致性验收测试（fix-search-mode-parity）。

对应 spec：
- per-tab-search → 整词配置参与匹配集与计数/导航
- find-widget-per-panel → 过滤模式隐藏不匹配行、清空/切回恢复、与 FILTER 图层叠加

任务：1.1 / 1.2 / 1.3
"""

import array
import json
import os
import sys
import threading
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bridge import FileBridge
from bridge.search_matching import compute_search_matches, intersect_sorted_indices


def _write_log(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        for line in lines:
            f.write(line + "\n")


def _search_config(query, *, whole_word=False, mode="highlight", case_sensitive=True):
    return {
        "query": query,
        "regex": False,
        "caseSensitive": case_sensitive,
        "wholeWord": whole_word,
        "mode": mode,
    }


def _wait_loaded(bridge, file_id, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        session = bridge._sessions.get(file_id)
        if session is not None and len(session.line_offsets) > 0:
            return True
        time.sleep(0.05)
    return False


def _sync_and_wait(bridge, file_id, layers_json, search_json, timeout=10):
    """连接信号 → sync_layers → 等待 pipelineFinished（缓存命中会同步 emit）。"""
    event = threading.Event()

    def on_finished(fid, *args):
        if fid == file_id:
            event.set()

    bridge.pipelineFinished.connect(on_finished)
    try:
        assert bridge.sync_layers(file_id, layers_json, search_json)
        return event.wait(timeout)
    finally:
        bridge.pipelineFinished.disconnect(on_finished)


@pytest.fixture
def isolated_bridge(tmp_path, monkeypatch):
    """隔离 HOME + 工作区的 FileBridge（缓存不污染真实 ~/.loglayer）。"""
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))
    workspace = tmp_path / "ws"
    workspace.mkdir()
    bridge = FileBridge()
    bridge.set_workspace_dir(str(workspace))
    return bridge, workspace


# ---------------------------------------------------------------------------
# 1.1 整词参与匹配集
# ---------------------------------------------------------------------------


def test_whole_word_excludes_substring_matches(rg_path, tmp_path):
    """整词模式只命中独立词，不命中 ERROR_CODE 这类子串行。"""
    path = tmp_path / "whole-word.log"
    _write_log(
        path,
        [
            "ERROR bad thing",
            "ERROR_CODE also bad",
            "error lower case",
            "prefix ERROR suffix",
        ],
    )

    plain = compute_search_matches(
        rg_path, str(path), _search_config("ERROR", whole_word=False)
    )
    whole = compute_search_matches(
        rg_path, str(path), _search_config("ERROR", whole_word=True)
    )

    assert list(plain) == [0, 1, 3], f"非整词应命中子串行: {list(plain)}"
    assert list(whole) == [0, 3], f"整词不应命中 ERROR_CODE: {list(whole)}"


# ---------------------------------------------------------------------------
# 1.2 有序数组双指针求交
# ---------------------------------------------------------------------------


def test_intersect_sorted_indices_cases():
    """全等、子集、空集、无交集均保持升序。"""
    assert list(intersect_sorted_indices(array.array("I", [1, 3, 5]), array.array("I", [3, 5, 7]))) == [3, 5]
    assert list(intersect_sorted_indices(array.array("I", [1, 2, 3]), array.array("I", [2]))) == [2]
    assert list(intersect_sorted_indices(array.array("I", [1, 2]), array.array("I", [1, 2]))) == [1, 2]
    assert list(intersect_sorted_indices(array.array("I", []), array.array("I", [1, 2]))) == []
    assert list(intersect_sorted_indices(array.array("I", [1, 3]), array.array("I", [2, 4]))) == []
    assert list(intersect_sorted_indices(array.array("I", [1, 3]), array.array("I", [0, 1, 2, 3, 4]))) == [1, 3]


def test_intersect_sorted_indices_large_input():
    """大数组求交结果正确且升序（覆盖双指针推进）。"""
    base = array.array("I", range(0, 20000, 2))
    matches = array.array("I", range(0, 20000, 3))
    result = list(intersect_sorted_indices(base, matches))
    expected = list(sorted(set(base) & set(matches)))
    assert result == expected
    assert result == sorted(result)


# ---------------------------------------------------------------------------
# 1.3 管线级：过滤模式可见集 / 切回恢复 / 缓存隔离
# ---------------------------------------------------------------------------


def _filter_layer(query, layer_id="filter-1"):
    return {
        "id": layer_id,
        "type": "FILTER",
        "name": "过滤",
        "enabled": True,
        "config": {"query": query},
    }


def test_filter_mode_visible_equals_matches_without_layers(isolated_bridge):
    """无图层时：过滤模式可见集 == 匹配集；切回高亮恢复全量。"""
    bridge, workspace = isolated_bridge
    path = workspace / "no-layer.log"
    _write_log(
        path,
        [
            "ERROR alpha",
            "INFO beta",
            "ERROR gamma",
            "INFO delta",
        ],
    )
    file_id = "f-no-layer"
    assert bridge.open_file(file_id, str(path))
    assert _wait_loaded(bridge, file_id)

    layer_json = json.dumps([])
    assert _sync_and_wait(
        bridge, file_id, layer_json, json.dumps(_search_config("alpha"))
    )
    session = bridge._sessions[file_id]
    assert session.visible_indices is None
    assert list(session.search_matches) == [0]

    assert _sync_and_wait(
        bridge, file_id, layer_json, json.dumps(_search_config("alpha", mode="filter"))
    )
    assert list(session.visible_indices) == [0], "过滤模式应只显示匹配行"

    assert _sync_and_wait(
        bridge, file_id, layer_json, json.dumps(_search_config("alpha"))
    )
    assert session.visible_indices is None, "切回高亮应恢复全量"

    bridge.close_file(file_id)


def test_filter_mode_composes_with_filter_layer_and_restores(isolated_bridge):
    """过滤模式与 FILTER 图层叠加；切回高亮/清空搜索恢复图层基础集。"""
    bridge, workspace = isolated_bridge
    path = workspace / "with-layer.log"
    _write_log(
        path,
        [
            "ERROR alpha",
            "INFO beta",
            "ERROR gamma",
            "INFO delta",
            "ERROR epsilon",
            "INFO zeta",
        ],
    )
    file_id = "f-with-layer"
    assert bridge.open_file(file_id, str(path))
    assert _wait_loaded(bridge, file_id)

    layers = json.dumps([_filter_layer("ERROR")])

    # 基线：FILTER 图层 → 3 行；搜索 alpha 仅高亮
    assert _sync_and_wait(
        bridge, file_id, layers, json.dumps(_search_config("alpha"))
    )
    session = bridge._sessions[file_id]
    assert list(session.visible_indices) == [0, 2, 4]

    # 过滤模式：图层 ∩ 搜索 → 仅第 0 行；匹配集同步收敛
    assert _sync_and_wait(
        bridge, file_id, layers, json.dumps(_search_config("alpha", mode="filter"))
    )
    assert list(session.visible_indices) == [0]
    assert list(session.search_matches) == [0], "过滤模式匹配集应只含可见匹配"

    # 图层隐藏了全部匹配（搜索 INFO，但图层只留 ERROR）→ 可见集与匹配集均为空
    assert _sync_and_wait(
        bridge, file_id, layers, json.dumps(_search_config("INFO", mode="filter"))
    )
    assert list(session.visible_indices) == []
    assert list(session.search_matches) == [], "被图层隐藏的匹配不应计入过滤模式"

    # 缓存必须保存基础集（3 行），而不是过滤后的 1 行
    store = bridge._get_cache_store()
    assert store is not None
    hit, cached_base = store.get_pipeline(session.path, session.layers_hash)
    assert hit and cached_base is not None and len(cached_base) == 3

    # 切回高亮：恢复图层基础集
    assert _sync_and_wait(
        bridge, file_id, layers, json.dumps(_search_config("alpha"))
    )
    assert list(session.visible_indices) == [0, 2, 4]

    # 清空搜索：仍保持图层基础集
    assert _sync_and_wait(bridge, file_id, layers, "")
    assert list(session.visible_indices) == [0, 2, 4]

    bridge.close_file(file_id)
