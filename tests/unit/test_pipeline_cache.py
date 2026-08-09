"""过滤/搜索结果缓存接入验收测试（任务 1.7 / 1.8 / 1.9）。

对应 spec: search-and-pipeline-cache
- Requirement 过滤结果缓存：相同图层配置缓存命中，不重跑过滤管线；配置变更失效。
- Requirement 搜索结果缓存：相同搜索词缓存命中，不重新扫描；缓存存物理行号；文件变更失效。
- Requirement 搜索与过滤管线解耦：改词不重跑过滤，改图层不重算搜索。
- Requirement 管线取消与替换：新任务取代旧任务，前序任务被取消；取消后子进程被回收。
"""
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

import bridge as bridge_module
from bridge import FileBridge


def _wait_until(predicate, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def _wait_loaded(bridge, file_id, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        s = bridge._sessions.get(file_id)
        if s is not None and len(s.line_offsets) > 0:
            return True
        time.sleep(0.05)
    return False


def _sync_and_wait(bridge, fid, layers, search="", timeout=10):
    """连接信号 → 触发 sync_layers → 等待 pipelineFinished。

    命中路径在 sync_layers 内同步 emit，未命中由 worker 异步 emit，
    因此必须先连接信号再触发，避免错过同步信号。
    """
    event = threading.Event()

    def on_finished(file_id, *args):
        if file_id == fid:
            event.set()

    bridge.pipelineFinished.connect(on_finished)
    try:
        assert bridge.sync_layers(fid, layers, search)
        return event.wait(timeout)
    finally:
        bridge.pipelineFinished.disconnect(on_finished)


def _search_config(query):
    return json.dumps({"query": query, "regex": False, "caseSensitive": False})


def test_memory_budget_links_cache_size(cache_bridge):
    """过滤/搜索内存层字节预算随 cache_size_mb 联动调整。"""
    bridge, _ = cache_bridge
    store = bridge._get_cache_store()

    bridge.set_cache_size_mb(2048)
    # 默认 1% 派生，最小 1MB 兜底
    assert store._pipeline_mem._max_bytes == 2048 * 1024 * 1024 // 100
    assert store._search_mem._max_bytes == 2048 * 1024 * 1024 // 100

    bridge.set_cache_size_mb(256)
    assert store._pipeline_mem._max_bytes == 256 * 1024 * 1024 // 100


@pytest.fixture
def cache_bridge(tmp_path, monkeypatch):
    """带工作区缓存的 FileBridge（隔离 HOME，避免污染真实 ~/.loglayer）。"""
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))  # Windows 兜底
    ws = tmp_path / "ws"
    ws.mkdir()
    bridge = FileBridge()
    bridge.set_workspace_dir(str(ws))
    return bridge, ws


def _filter_layer(query, lid="l1"):
    return {"id": lid, "type": "FILTER", "enabled": True, "config": {"query": query}}


def test_pipeline_cache_hit_skips_pipeline(cache_bridge):
    """相同图层配置二次 sync_layers：命中缓存跳过管线，computed 不增、memory_hit 增。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    layers = json.dumps([_filter_layer("ERROR")])
    assert _sync_and_wait(bridge, fid, layers)

    store = bridge._get_cache_store()
    assert store is not None, "工作区缓存应存在"
    assert store.get_stats()["pipeline"]["computed"] == 1, "首次计算应计入 computed"

    assert _sync_and_wait(bridge, fid, layers)

    stats = store.get_stats()
    assert stats["pipeline"]["computed"] == 1, "相同配置二次同步不应重新计算"
    assert stats["pipeline"]["memory_hit"] >= 1, "应命中内存缓存"

    session = bridge._sessions[fid]
    assert session.visible_indices is not None, "应恢复缓存可见行集"
    assert len(session.visible_indices) == 10, "ERROR 行应为 10 行"


def test_pipeline_cache_invalidated_on_config_change(cache_bridge):
    """图层配置变化（layers_hash 不同）：缓存失效并重新计算。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    store = bridge._get_cache_store()

    layers_error = json.dumps([_filter_layer("ERROR")])
    assert _sync_and_wait(bridge, fid, layers_error)
    assert store.get_stats()["pipeline"]["computed"] == 1
    assert len(bridge._sessions[fid].visible_indices) == 10

    layers_info = json.dumps([_filter_layer("INFO")])
    assert _sync_and_wait(bridge, fid, layers_info)

    stats = store.get_stats()
    assert stats["pipeline"]["computed"] == 2, "配置变更应重新计算"
    assert len(bridge._sessions[fid].visible_indices) == 10, "INFO 行应为 10 行"

    # 切回原配置：命中第一份缓存（两层配置各留一份）
    assert _sync_and_wait(bridge, fid, layers_error)
    stats = store.get_stats()
    assert stats["pipeline"]["computed"] == 2, "切回原配置应命中缓存，不再计算"


def test_search_cache_hit_skips_scan(cache_bridge):
    """相同搜索词二次同步：搜索命中缓存跳过 rg 扫描，search.computed 不增、memory_hit 增。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    layers = json.dumps([_filter_layer("ERROR")])
    search = _search_config("INFO")
    assert _sync_and_wait(bridge, fid, layers, search)

    store = bridge._get_cache_store()
    assert store is not None, "工作区缓存应存在"
    assert store.get_stats()["search"]["computed"] == 1, "首次搜索应计入 computed"

    assert _sync_and_wait(bridge, fid, layers, search)

    stats = store.get_stats()
    assert stats["search"]["computed"] == 1, "相同搜索词二次同步不应重新扫描"
    assert stats["search"]["memory_hit"] >= 1, "应命中搜索内存缓存"

    session = bridge._sessions[fid]
    assert session.search_matches is not None, "应恢复缓存匹配结果"
    assert len(session.search_matches) == 10, "INFO 行应为 10 个物理行号"


def test_search_cache_stores_physical_line_numbers(cache_bridge):
    """搜索缓存存物理行号：过滤后仍为全文件物理行号（非可见索引）。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    layers = json.dumps([_filter_layer("ERROR")])
    assert _sync_and_wait(bridge, fid, layers, _search_config("INFO"))

    session = bridge._sessions[fid]
    assert session.visible_indices is not None
    assert len(session.visible_indices) == 10, "ERROR 行 10 行"
    # 匹配为全文件物理行号（0-based），不受 FILTER 影响
    assert session.search_matches.tolist() == [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]


def test_search_cache_invalidated_on_file_change(cache_bridge):
    """文件内容变化（file_hash 不同）：搜索缓存失效并重新计算。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    layers = json.dumps([_filter_layer("ERROR")])
    search = _search_config("INFO")
    assert _sync_and_wait(bridge, fid, layers, search)

    store = bridge._get_cache_store()
    assert store.get_stats()["search"]["computed"] == 1

    # 修改文件内容（INFO→WARN），重新打开以重建索引
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'WARN'} msg\n")
    bridge.close_file(fid)
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    assert _sync_and_wait(bridge, fid, layers, search)

    stats = store.get_stats()
    assert stats["search"]["computed"] == 2, "文件变更应使搜索缓存失效并重新计算"
    session = bridge._sessions[fid]
    assert len(session.search_matches) == 0, "新文件无 INFO 行"


def test_search_and_filter_decoupled(cache_bridge):
    """解耦：改词不重跑过滤（pipeline.computed 不增）；改图层不重算搜索（search.computed 不增）。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    store = bridge._get_cache_store()
    layers_error = json.dumps([_filter_layer("ERROR")])

    # 基线：ERROR 过滤 + INFO 搜索
    assert _sync_and_wait(bridge, fid, layers_error, _search_config("INFO"))
    assert store.get_stats()["pipeline"]["computed"] == 1
    assert store.get_stats()["search"]["computed"] == 1

    # 修改搜索词（INFO→WARN）：仅重算搜索，过滤复用缓存
    assert _sync_and_wait(bridge, fid, layers_error, _search_config("WARN"))
    stats = store.get_stats()
    assert stats["pipeline"]["computed"] == 1, "改词不应重跑过滤管线"
    assert stats["search"]["computed"] == 2, "改词应重新计算搜索"

    # 修改图层（ERROR→INFO 过滤）：仅重跑过滤，搜索复用缓存
    layers_info = json.dumps([_filter_layer("INFO")])
    assert _sync_and_wait(bridge, fid, layers_info, _search_config("WARN"))
    stats = store.get_stats()
    assert stats["pipeline"]["computed"] == 2, "改图层应重跑过滤管线"
    assert stats["search"]["computed"] == 2, "改图层不应重算搜索"


def test_pipeline_new_task_replaces_old(cache_bridge):
    """新任务取代旧任务：快速连续两次 sync，旧 worker 被取消并回收，仅最新结果落位。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    layers = json.dumps([_filter_layer("ERROR")])

    # 第一次 sync：启动 worker A（不等待完成）
    assert bridge.sync_layers(fid, layers, _search_config("INFO"))
    worker_a = bridge._sessions[fid].workers["pipeline"]
    assert worker_a is not None, "worker A 应已创建"

    # 第二次 sync（改词 → 搜索缓存 miss）：worker B 取代 worker A
    assert _sync_and_wait(bridge, fid, layers, _search_config("WARN"))
    worker_b = bridge._sessions[fid].workers["pipeline"]
    assert worker_b is not worker_a, "新任务应替换旧 worker"
    assert worker_a.is_cancelled(), "旧 worker 应被取消"

    # 旧 worker 最终从 zombie 列表移除（reap 线程回收），不残留
    assert _wait_until(lambda: worker_a not in bridge._zombie_workers), (
        "旧 worker 应从 zombie 列表回收"
    )
    assert len(bridge._sessions[fid].search_matches) == 0, "新搜索词 WARN 无匹配"


def test_retire_worker_idempotent(cache_bridge):
    """重复退役同一 worker（缓存命中路径残留引用）：已在 zombie 列表时早退，不重复入列。"""
    bridge, ws = cache_bridge
    log = ws / "app.log"
    with open(log, "w", encoding="utf-8") as f:
        for i in range(20):
            f.write(f"line {i}: {'ERROR' if i % 2 == 0 else 'INFO'} msg\n")

    fid = "f1"
    assert bridge.open_file(fid, str(log))
    assert _wait_loaded(bridge, fid)

    layers = json.dumps([_filter_layer("ERROR")])
    assert _sync_and_wait(bridge, fid, layers, _search_config("INFO"))
    worker = bridge._sessions[fid].workers["pipeline"]

    # 模拟缓存命中路径残留：worker 已在 zombie 列表，重复退役应早退
    bridge._zombie_workers.append(worker)
    bridge._retire_worker(worker)
    assert bridge._zombie_workers.count(worker) == 1, "已入列 worker 不应重复入列"
    bridge._retire_worker(worker)
    assert bridge._zombie_workers.count(worker) == 1, "重复退役仍应早退"
    bridge._zombie_workers.remove(worker)  # 清理测试残留


class _FakePopen:
    def __init__(self, *args, **kwargs):
        self.terminated = False
        self.killed = False
        self._waited = False
        self.stdout = iter([b"1: line one\n", b"2: line two\n"])

    def wait(self, timeout=None):
        self._waited = True
        return 0

    def poll(self):
        if self._waited or self.terminated or self.killed:
            return 0
        return None

    def terminate(self):
        self.terminated = True

    def kill(self):
        self.killed = True


def test_cancel_terminates_search_subprocess(cache_bridge, monkeypatch):
    """取消搜索：rg 子进程被 terminate；正常完成不误杀。"""
    bridge, ws = cache_bridge
    search_config = {"query": "INFO", "regex": False, "caseSensitive": False}
    fake1 = _FakePopen()
    monkeypatch.setattr(bridge_module.subprocess, "Popen", lambda *a, **kw: fake1)

    # 正常路径（不取消）：读完两行，matches=[0,1]，子进程不被 kill
    matches = bridge_module.compute_search_matches(
        "rg", str(ws / "app.log"), search_config, is_cancelled=lambda: False
    )
    assert matches.tolist() == [0, 1], "正常路径应读完两行匹配"
    assert not fake1.terminated, "正常完成不应 terminate 子进程"

    # 取消路径：循环中途触发取消 → 子进程被 terminate
    fake2 = _FakePopen()
    monkeypatch.setattr(bridge_module.subprocess, "Popen", lambda *a, **kw: fake2)
    matches = bridge_module.compute_search_matches(
        "rg", str(ws / "app.log"), search_config, is_cancelled=lambda: True
    )
    assert fake2.terminated, "取消时应 terminate rg 子进程"
    assert len(matches) == 0, "取消后不应有匹配"
