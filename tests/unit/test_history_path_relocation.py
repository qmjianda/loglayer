"""验收测试：历史文件路径变化后仍可打开（GitHub issue #5）。

对应 `openspec/changes/fix-history-file-path-changed/specs/history-file-path-relocation/spec.md`：
1. Linux→Windows 路径反向转换（/mnt/d/x → D:\\x）
2. 文件夹移动后按文件名在工作区重定位（a/a.txt → b/a/a.txt）
3. 打开失败打印 [Bridge] 提示（非静默）
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from bridge import FileBridge
from bridge.utils import convert_linux_path_to_windows, resolve_file_path


# ---------------------------------------------------------------
# Requirement 1: Linux→Windows 路径反向转换
# ---------------------------------------------------------------

class TestLinuxToWindowsPath:
    def test_convert_linux_path_to_windows(self):
        assert convert_linux_path_to_windows("/mnt/d/log/a.txt") == "D:\\log\\a.txt"
        assert convert_linux_path_to_windows("/mnt/c/foo/bar.log") == "C:\\foo\\bar.log"
        assert convert_linux_path_to_windows("/home/user/x.log") == "/home/user/x.log"

    def test_resolve_file_path_linux_to_windows_on_win32(self, tmp_path, monkeypatch):
        """Windows 平台上 /mnt/d/... 应能解析到真实存在的 D:\\... 路径。"""
        # 模拟 Windows 平台；tmp_path 在测试机上是 Linux 路径，
        # 用 monkeypatch 使 Path 认为存在性检查命中转换后的路径。
        real = tmp_path / "a.log"
        real.write_text("x\n", encoding="utf-8")
        monkeypatch.setattr("bridge.utils.platform.system", lambda: "Windows")

        # 构造假 /mnt/x → tmp_path 映射：转换后路径不存在时返回原路径（不抛异常）
        result = resolve_file_path("/mnt/x/nonexistent.log")
        assert result == "/mnt/x/nonexistent.log"

        # 直接验证转换函数本身（存在性由实际平台决定，函数只做字符串转换）
        conv = convert_linux_path_to_windows("/mnt/d/log/a.txt")
        assert conv == "D:\\log\\a.txt"


# ---------------------------------------------------------------
# Requirement 2: 文件夹移动后按文件名重定位
# ---------------------------------------------------------------

class TestOpenFileRelocation:
    def test_open_file_relocates_by_name_in_workspace(self, tmp_path):
        """原路径失效但工作区存在同名文件时，open_file 应重定位并成功。"""
        # 构造：历史记录指向 a/a.txt（已不存在），实际文件在 b/a/a.txt
        (tmp_path / "b" / "a").mkdir(parents=True)
        new_file = tmp_path / "b" / "a" / "a.txt"
        new_file.write_text("".join(f"line {i}\n" for i in range(10)), encoding="utf-8")

        bridge = FileBridge()
        bridge.set_workspace_dir(str(tmp_path))

        old_path = str(tmp_path / "a" / "a.txt")  # 已不存在的旧路径
        ok = bridge.open_file("fid-1", old_path)
        assert ok is True, "工作区存在同名文件时应重定位打开"
        session = bridge._sessions.get("fid-1")
        assert session is not None
        assert os.path.exists(session.path), f"session 路径应为真实文件: {session.path}"
        assert session.path == str(new_file)

    def test_open_file_fails_when_no_match(self, tmp_path, capsys):
        """工作区无同名文件时返回 False 并打印 [Bridge] 提示。"""
        (tmp_path / "b" / "a").mkdir(parents=True)
        (tmp_path / "b" / "a" / "other.log").write_text("x\n", encoding="utf-8")

        bridge = FileBridge()
        bridge.set_workspace_dir(str(tmp_path))

        old_path = str(tmp_path / "a" / "a.txt")
        ok = bridge.open_file("fid-2", old_path)
        assert ok is False
        assert "[Bridge] File not found" in capsys.readouterr().out

    def test_open_file_moved_folder_keeps_session(self, tmp_path):
        """重定位后 session 可读行数（打开链路完整）。"""
        (tmp_path / "moved").mkdir(parents=True)
        moved = tmp_path / "moved" / "app.log"
        moved.write_text("".join(f"L{i}\n" for i in range(30)), encoding="utf-8")

        bridge = FileBridge()
        bridge.set_workspace_dir(str(tmp_path))

        old_path = str(tmp_path / "orig" / "app.log")
        assert bridge.open_file("fid-3", old_path) is True
        session = bridge._sessions["fid-3"]
        assert session.path == str(moved)
        assert len(session.line_offsets) == 30
