"""验收测试：历史文件路径以相对工作区根的形式持久化（refactor-history-relative-path）。

对应 `openspec/changes/refactor-history-relative-path/specs/history-file-path-storage/spec.md`：
1. 工作区内文件存相对路径（POSIX `/` 分隔符）；工作区外/跨盘存绝对路径兜底
2. 读取时存储原样往返（相对/绝对共存），前端负责拼根
3. 失效路径非静默失败（`[Bridge] File not found`），不递归扫描工作区
4. 书签 key 基于历史存储路径（相对/绝对）而非会话绝对路径
5. 单文件打开以文件所在目录为工作区根

存储层（save_workspace_config / set_workspace_files）为纯存储逻辑，
无需真实文件；open_file / 书签测试需要真实小文件。
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

from bridge import FileBridge


def _make_bridge():
    return FileBridge()


def _entry(path, name=None):
    return {
        "path": path,
        "name": name or os.path.basename(path),
        "size": 1,
        "layers": [],
        "wasOpen": True,
    }


# ---------------------------------------------------------------
# Requirement 1: 历史文件路径以相对路径存储（工作区内相对化，工作区外绝对兜底）
# ---------------------------------------------------------------

class TestWorkspaceFileStorageRelative:
    def test_inside_workspace_stored_as_relative_path(self, tmp_path):
        """工作区内文件（含子目录）经 save_workspace_config 存为 POSIX 相对路径。"""
        root = tmp_path / "ws"
        (root / "logs").mkdir(parents=True)
        abs_path = str(root / "logs" / "app.log")
        config = {
            "files": [_entry(abs_path)],
            "activeFilePath": abs_path,
        }

        bridge = _make_bridge()
        assert bridge.save_workspace_config(str(root), json.dumps(config)) is True

        files = bridge.get_workspace_files(str(root))
        assert len(files) == 1
        stored = files[0]["path"]
        # 相对工作区根、POSIX 分隔符、不含盘符/挂载点
        assert stored == "logs/app.log"
        assert "/" in stored and "\\" not in stored
        assert bridge.get_workspace_state("activeFilePath", str(root)) == "logs/app.log"

    def test_set_workspace_files_relativizes_too(self, tmp_path):
        """set_workspace_files 与 save_workspace_config 共用相对化逻辑。"""
        root = tmp_path / "ws"
        root.mkdir()
        abs_path = str(root / "a.log")

        bridge = _make_bridge()
        assert bridge.set_workspace_files(str(root), [_entry(abs_path)]) is True
        files = bridge.get_workspace_files(str(root))
        assert files[0]["path"] == "a.log"

    def test_outside_workspace_falls_back_to_absolute(self, tmp_path):
        """工作区外文件（相对化产生 `..` 溢出）存绝对路径，不影响其他条目。"""
        root = tmp_path / "ws"
        root.mkdir()
        inside = str(root / "in.log")
        outside_dir = tmp_path / "outside"
        outside_dir.mkdir()
        outside = str(outside_dir / "out.log")

        bridge = _make_bridge()
        config = {"files": [_entry(inside), _entry(outside)], "activeFilePath": ""}
        assert bridge.save_workspace_config(str(root), json.dumps(config)) is True

        files = {f["path"] for f in bridge.get_workspace_files(str(root))}
        assert "in.log" in files, "工作区内条目应相对化"
        assert outside in files, "工作区外条目应以绝对路径原样存储（不抛异常）"


# ---------------------------------------------------------------
# Requirement 2: 读取时惰性兼容（存储原样往返，相对/绝对共存）
# ---------------------------------------------------------------

class TestWorkspaceFileLoadLazyCompat:
    def test_relative_path_returned_as_is(self, tmp_path):
        """save 相对路径后 load 返回原样相对路径（拼根属于前端 resolvePath 职责）。"""
        root = tmp_path / "ws"
        (root / "logs").mkdir(parents=True)
        abs_path = str(root / "logs" / "app.log")

        bridge = _make_bridge()
        assert bridge.save_workspace_config(
            str(root), json.dumps({"files": [_entry(abs_path)], "activeFilePath": abs_path})
        ) is True

        loaded = json.loads(bridge.load_workspace_config(str(root)))
        assert loaded["files"][0]["path"] == "logs/app.log"
        assert loaded["activeFilePath"] == "logs/app.log"

    def test_legacy_absolute_data_kept_as_is(self, tmp_path):
        """旧版本写入的绝对路径条目原样读取，与相对路径条目共存互不干扰。"""
        root = tmp_path / "ws"
        root.mkdir()
        legacy_abs = str(root / "legacy" / "old.log")  # 模拟旧数据（不经相对化写入）
        rel = "new.log"

        store = _make_bridge()._get_workspace_store(str(root))
        assert store is not None
        store.set_files([_entry(legacy_abs), _entry(str(root / "new.log"), "new.log")])
        # 模拟旧数据：直接改写为绝对路径（绕开相对化写入）
        store.delete_file("new.log")
        store.upsert_file(_entry(legacy_abs))

        bridge = _make_bridge()
        files = bridge.get_workspace_files(str(root))
        paths = {f["path"] for f in files}
        assert legacy_abs in paths, "绝对路径旧数据应原样保留"
        # 相对/绝对条目共存且加载不抛异常
        loaded = json.loads(bridge.load_workspace_config(str(root)))
        assert any(f["path"] == legacy_abs for f in loaded["files"])


# ---------------------------------------------------------------
# Requirement 3: 书签随路径相对化持久化
# ---------------------------------------------------------------

class TestBookmarkKeyRelative:
    def test_bookmark_key_relativized_for_workspace_file(self, tmp_path):
        """工作区内文件 toggle_bookmark 后，bookmarks.<相对路径> 有值。"""
        root = tmp_path / "ws"
        (root / "logs").mkdir(parents=True)
        file_path = root / "logs" / "app.log"
        file_path.write_text("".join(f"line {i}\n" for i in range(10)), encoding="utf-8")

        bridge = _make_bridge()
        bridge.set_workspace_dir(str(root))
        assert bridge.open_file("fid", str(file_path)) is True
        bridge.toggle_bookmark("fid", 2)

        store = bridge._get_workspace_store()
        assert store is not None
        # 新 key：基于相对历史路径；旧式绝对路径 key 不写入
        assert store.get("bookmarks.logs/app.log") is not None
        assert store.get(f"bookmarks.{file_path}") is None

    def test_bookmark_restored_after_reopen(self, tmp_path):
        """重开文件后书签从相对 key 恢复，行号与添加时一致。"""
        root = tmp_path / "ws"
        root.mkdir()
        file_path = root / "app.log"
        file_path.write_text("".join(f"line {i}\n" for i in range(10)), encoding="utf-8")

        bridge = _make_bridge()
        bridge.set_workspace_dir(str(root))
        assert bridge.open_file("fid", str(file_path)) is True
        bridge.toggle_bookmark("fid", 2)
        bridge.toggle_bookmark("fid", 5)

        bridge.close_file("fid")
        assert bridge.open_file("fid", str(file_path)) is True
        bookmarks = json.loads(bridge.get_bookmarks("fid"))
        assert set(bookmarks.keys()) == {"2", "5"}, "重开后书签行号应与添加时一致"

    def test_outside_workspace_bookmark_key_absolute(self, tmp_path):
        """工作区外文件书签仍按绝对路径持久化并可恢复。"""
        root = tmp_path / "ws"
        root.mkdir()
        outside = tmp_path.parent / f"{tmp_path.name}-outside"
        outside.mkdir(exist_ok=True)
        file_path = outside / "out.log"
        file_path.write_text("".join(f"line {i}\n" for i in range(5)), encoding="utf-8")

        bridge = _make_bridge()
        bridge.set_workspace_dir(str(root))
        assert bridge.open_file("fid", str(file_path)) is True
        bridge.toggle_bookmark("fid", 1)

        store = bridge._get_workspace_store()
        assert store.get(f"bookmarks.{file_path}") is not None, "工作区外书签按绝对路径持久化"

        bridge.close_file("fid")
        assert bridge.open_file("fid", str(file_path)) is True
        bookmarks = json.loads(bridge.get_bookmarks("fid"))
        assert "1" in bookmarks, "重开同一绝对路径文件时书签可恢复"


# ---------------------------------------------------------------
# Requirement 4: 路径失效时非静默失败（不递归扫描工作区）
# ---------------------------------------------------------------

class TestOpenFileFailure:
    def test_missing_path_fails_with_message_no_relocation(self, tmp_path, capsys):
        """工作区存在同名文件也不重定位：返回 False 并打印 [Bridge] File not found。"""
        (tmp_path / "b" / "a").mkdir(parents=True)
        (tmp_path / "b" / "a" / "a.txt").write_text("x\n", encoding="utf-8")

        bridge = _make_bridge()
        bridge.set_workspace_dir(str(tmp_path))

        old_path = str(tmp_path / "a" / "a.txt")  # 不存在，但工作区有同名文件
        assert bridge.open_file("fid", old_path) is False
        assert "[Bridge] File not found" in capsys.readouterr().out
        assert "fid" not in bridge._sessions, "失败不应建立 session"


# ---------------------------------------------------------------
# Requirement 5: 打开单文件时以文件所在目录为工作区根
# ---------------------------------------------------------------

class TestSingleFileWorkspaceRoot:
    def test_single_file_open_establishes_workspace_root(self, tmp_path):
        """未设工作区时打开单文件 → 根 = 文件所在目录，历史存相对路径。"""
        file_path = tmp_path / "app.log"
        file_path.write_text("".join(f"line {i}\n" for i in range(5)), encoding="utf-8")

        bridge = _make_bridge()
        assert bridge._workspace_dir is None
        assert bridge.open_file("fid", str(file_path)) is True
        assert bridge._workspace_dir == str(tmp_path), "单文件打开应把文件所在目录设为工作区根"

        # 根已建立：历史条目存为相对根路径（此文件恰在根下 → 裸文件名）
        assert bridge.save_workspace_config(
            str(tmp_path), json.dumps({"files": [_entry(str(file_path))]})
        ) is True
        files = bridge.get_workspace_files(str(tmp_path))
        assert files[0]["path"] == "app.log"

    def test_single_file_open_keeps_existing_workspace(self, tmp_path):
        """已有工作区时打开工作区内文件：不改变根，条目相对该根存储。"""
        root = tmp_path / "ws"
        (root / "sub").mkdir(parents=True)
        file_path = root / "sub" / "app.log"
        file_path.write_text("x\n", encoding="utf-8")

        bridge = _make_bridge()
        bridge.set_workspace_dir(str(root))
        assert bridge.open_file("fid", str(file_path)) is True
        assert bridge._workspace_dir == str(root), "已有工作区不应被单文件打开改变"

        assert bridge.save_workspace_config(
            str(root), json.dumps({"files": [_entry(str(file_path))]})
        ) is True
        files = bridge.get_workspace_files(str(root))
        assert files[0]["path"] == "sub/app.log"


# ---------------------------------------------------------------
# _to_stored_path 纯函数单元测试（task 5.3：工作区内相对化 /
# 工作区外与跨盘绝对兜底 / POSIX 分隔符）
# ---------------------------------------------------------------

class TestToStoredPath:
    def test_inside_workspace_relativized_posix(self, tmp_path):
        root = str(tmp_path / "ws")
        abs_path = os.path.join(root, "logs", "app.log")
        result = FileBridge._to_stored_path(root, abs_path)
        assert result == "logs/app.log"
        assert "\\" not in result, "存储路径必须使用 POSIX 分隔符"

    def test_outside_workspace_absolute_fallback(self, tmp_path):
        root = str(tmp_path / "ws")
        outside = str(tmp_path / "outside" / "x.log")
        assert FileBridge._to_stored_path(root, outside) == outside

    def test_empty_root_absolute_fallback(self, tmp_path):
        abs_path = str(tmp_path / "x.log")
        assert FileBridge._to_stored_path("", abs_path) == abs_path

    def test_cross_drive_absolute_fallback(self, tmp_path, monkeypatch):
        """跨盘（os.path.relpath 抛 ValueError）时返回原绝对路径。"""
        root = str(tmp_path / "ws")
        abs_path = str(tmp_path / "x.log")

        def _raise_relpath(path, start):
            raise ValueError("跨盘无法相对化")

        monkeypatch.setattr(os.path, "relpath", _raise_relpath)
        assert FileBridge._to_stored_path(root, abs_path) == abs_path
