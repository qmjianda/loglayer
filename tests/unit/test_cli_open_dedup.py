"""CLI 预加载文件路径去重回归测试（原 e2e test_reopen_same_file_no_duplicate_tab
被改为纯 UI 打开后，CLI 侧去重契约由本单测兜底）。

回归点：
1. cli_file_id 必须跨进程稳定（同一文件每次启动得到相同 id），否则前端按
   file_id 的路径去重会失效——曾出现 CLI 路径为仅文件名时产生重复面板。
2. resolve_file_path 对裸文件名（相对路径）应归一化为可用的绝对/存在路径。
3. 同一 file_id 二次 open_file 应替换旧 session，不残留重复状态。
"""
import os
import sys
import subprocess

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from bridge import FileBridge, resolve_file_path
from main import cli_file_id


@pytest.fixture
def log_file(tmp_path):
    path = tmp_path / "app.log"
    path.write_text("".join(f"line {i}: data\n" for i in range(50)), encoding="utf-8")
    return path


def test_cli_file_id_deterministic_across_processes(log_file):
    """同一文件在不同进程/不同 hash 种子下 file_id 必须一致（去重前提）。"""
    def _run_with_seed(seed):
        env = dict(os.environ, PYTHONHASHSEED=seed)
        out = subprocess.run(
            [sys.executable, "-c",
             "import sys; sys.path.insert(0,'backend');"
             f"from main import cli_file_id; print(cli_file_id({str(log_file)!r}))"],
            capture_output=True, text=True, env=env, check=True,
        ).stdout.strip()
        return out.splitlines()[-1]

    a = _run_with_seed("0")
    b = _run_with_seed("1")
    assert a and a == b, f"file_id 跨进程不稳定: {a} vs {b}"
    assert a.startswith("cli-")


def test_cli_file_id_stable_across_calls(log_file):
    """同进程内重复调用返回相同 id，且含稳定内容 hash（非内置 hash 位模式）。"""
    assert cli_file_id(str(log_file)) == cli_file_id(str(log_file))


def test_resolve_file_path_normalizes_bare_filename(tmp_path):
    """裸文件名（相对路径）经 resolve_file_path 后应指向存在的文件。"""
    target = tmp_path / "bare.log"
    target.write_text("x\n", encoding="utf-8")
    cwd = os.getcwd()
    try:
        os.chdir(tmp_path)
        resolved = resolve_file_path("bare.log")
        assert os.path.exists(resolved), f"resolve_file_path 未归一化: {resolved}"
        assert os.path.basename(resolved) == "bare.log"
    finally:
        os.chdir(cwd)


def test_open_file_same_file_id_replaces_session(log_file):
    """同一 file_id 二次打开同一路径：旧 session 被替换，_sessions 不残留重复。"""
    bridge = FileBridge()
    fid = cli_file_id(str(log_file))

    assert bridge.open_file(fid, str(log_file)) is True
    s1 = bridge._sessions.get(fid)
    assert s1 is not None, "首次打开应建立 session"

    assert bridge.open_file(fid, str(log_file)) is True
    s2 = bridge._sessions.get(fid)
    assert s2 is not None
    assert bridge._sessions[fid] is not s1, "二次打开应替换旧 session 对象"
    assert len(bridge._sessions) == 1, "同一 file_id 不应残留多个 session"
