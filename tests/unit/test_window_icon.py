"""验收测试：Windows 平台 pywebview 图标兼容（GitHub issue #2）。

对应 `openspec/changes/fix-pywebview-icon-windows/specs/pywebview-icon-windows-compat/spec.md`：
1. Windows + 非 .ico → None
2. Windows + .ico 存在 → 返回路径
3. 非 Windows + 存在 → 返回路径
4. 路径不存在 → None
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from bridge.utils import select_window_icon


class TestSelectWindowIcon:
    def test_windows_png_returns_none(self, tmp_path, monkeypatch, capsys):
        """Windows 平台传 PNG 图标应返回 None（避免 .NET Icon 崩溃）。"""
        icon = tmp_path / "icon.png"
        icon.write_bytes(b"png-bytes")
        monkeypatch.setattr("bridge.utils.platform.system", lambda: "Windows")
        assert select_window_icon(str(icon)) is None
        assert "[Main]" in capsys.readouterr().out

    def test_windows_ico_returns_path(self, tmp_path, monkeypatch):
        """Windows 平台 .ico 文件应被接受。"""
        icon = tmp_path / "icon.ico"
        icon.write_bytes(b"ico-bytes")
        monkeypatch.setattr("bridge.utils.platform.system", lambda: "Windows")
        assert select_window_icon(str(icon)) == str(icon)

    def test_non_windows_png_returns_path(self, tmp_path, monkeypatch):
        """非 Windows 平台 PNG 图标应被接受（GTK 支持 PNG）。"""
        icon = tmp_path / "icon.png"
        icon.write_bytes(b"png-bytes")
        monkeypatch.setattr("bridge.utils.platform.system", lambda: "Linux")
        assert select_window_icon(str(icon)) == str(icon)

    def test_missing_path_returns_none(self, tmp_path, monkeypatch):
        """路径不存在时任何平台都返回 None。"""
        monkeypatch.setattr("bridge.utils.platform.system", lambda: "Linux")
        assert select_window_icon(str(tmp_path / "nope.ico")) is None
