"""缓存数据库存储位置回归测试：cache.db 必须存工作区 `.loglayer/`，不得使用全局目录。

背景：曾将缓存 DB 固定存 `~/.loglayer/cache.db`（全局）。现要求一律存
工作区 `.loglayer/cache.db`：有工作区存工作区，无工作区时以文件所在目录兜底。
"""
import os
import sys
import tempfile
import glob
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from bridge import FileBridge


@pytest.fixture
def clean_home_loglayer(monkeypatch, tmp_path):
    """隔离 HOME，避免污染真实 ~/.loglayer，并确保测试内无全局缓存残留。"""
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    monkeypatch.setenv("HOME", str(fake_home))
    monkeypatch.setenv("USERPROFILE", str(fake_home))  # Windows 兜底
    return fake_home


def _write_file(dir_path, name="app.log", lines=10):
    path = os.path.join(dir_path, name)
    with open(path, "w", encoding="utf-8") as f:
        for i in range(lines):
            f.write(f"line {i}: data\n")
    return path


def _wait_loaded(bridge, file_id, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        s = bridge._sessions.get(file_id)
        if s is not None and len(s.line_offsets) > 0:
            return True
        time.sleep(0.05)
    return False


def test_set_workspace_dir_uses_workspace_cache(clean_home_loglayer, tmp_path):
    """set_workspace_dir 后 cache.db 落在工作区 .loglayer/，而非全局目录。"""
    ws1 = str(tmp_path / "ws1")
    ws2 = str(tmp_path / "ws2")
    os.makedirs(ws1, exist_ok=True)
    os.makedirs(ws2, exist_ok=True)

    bridge = FileBridge()
    assert bridge._cache is None or str(bridge._cache.db_path) != os.path.expanduser(
        "~/.loglayer/cache.db"
    ), "不应使用全局 ~/.loglayer/cache.db"

    bridge.set_workspace_dir(ws1)
    assert str(bridge._cache.db_path) == os.path.join(ws1, ".loglayer", "cache.db")
    assert not os.path.exists(os.path.join(os.path.expanduser("~"), ".loglayer", "cache.db"))


def test_workspace_cache_isolated(clean_home_loglayer, tmp_path):
    """不同工作区缓存互相隔离，切回原工作区数据保留。"""
    ws1 = str(tmp_path / "ws1")
    ws2 = str(tmp_path / "ws2")
    os.makedirs(ws1, exist_ok=True)
    os.makedirs(ws2, exist_ok=True)
    p1 = _write_file(ws1)
    p2 = _write_file(ws2)

    bridge = FileBridge()
    bridge.set_workspace_dir(ws1)
    fid1 = "f1"
    bridge.open_file(fid1, p1)
    assert _wait_loaded(bridge, fid1)
    bridge.close_file(fid1)
    time.sleep(0.1)
    assert len(bridge._cache.get_entries()) == 1, "ws1 应有 1 条缓存"

    # 切到 ws2：缓存隔离为空
    bridge.set_workspace_dir(ws2)
    assert len(bridge._cache.get_entries()) == 0, "ws2 缓存应隔离为空"

    # 打开 ws2 文件，写入 ws2 缓存
    fid2 = "f2"
    bridge.open_file(fid2, p2)
    assert _wait_loaded(bridge, fid2)
    bridge.close_file(fid2)
    time.sleep(0.1)
    assert len(bridge._cache.get_entries()) == 1

    # 切回 ws1：数据保留
    bridge.set_workspace_dir(ws1)
    assert len(bridge._cache.get_entries()) == 1, "切回 ws1 后缓存应保留"


def test_open_file_without_workspace_uses_file_dir(clean_home_loglayer, tmp_path):
    """未设置工作区直接 open_file：cache.db 落到文件所在目录 .loglayer/。"""
    ws = str(tmp_path / "logs")
    os.makedirs(ws, exist_ok=True)
    p = _write_file(ws)

    bridge = FileBridge()
    assert bridge._workspace_dir is None

    fid = "f1"
    bridge.open_file(fid, p)
    assert _wait_loaded(bridge, fid)
    assert bridge._workspace_dir == ws, "open_file 应以文件目录作为工作区"
    assert str(bridge._cache.db_path) == os.path.join(ws, ".loglayer", "cache.db")
    assert os.path.exists(os.path.join(ws, ".loglayer", "cache.db")), "cache.db 应落在文件目录"

    bridge.close_file(fid)


def test_no_global_cache_created(clean_home_loglayer, tmp_path):
    """完整流程结束后，全局 ~/.loglayer/cache.db 不应被创建。"""
    ws = str(tmp_path / "logs")
    os.makedirs(ws, exist_ok=True)
    p = _write_file(ws)

    bridge = FileBridge()
    bridge.set_workspace_dir(ws)
    fid = "f1"
    bridge.open_file(fid, p)
    assert _wait_loaded(bridge, fid)
    bridge.close_file(fid)
    time.sleep(0.1)

    global_dir = os.path.join(os.path.expanduser("~"), ".loglayer")
    assert not os.path.exists(os.path.join(global_dir, "cache.db")), (
        f"全局缓存不应存在: {os.path.join(global_dir, 'cache.db')}"
    )
