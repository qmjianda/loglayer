"""工作区统一存储单元测试：workspace_store.py（KV + 文件历史 + schema 版本 + 原子写）。

背景：持久化从 `.loglayer/config.json` + localStorage 迁移到统一 SQLite 底座
（`.loglayer/workspace.db`），承载布局/书签/文件历史等工作区级状态。
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from pathlib import Path

from loglayer.workspace_store import DATA_VERSION, WorkspaceStore


def _make_store(tmp_path):
    return WorkspaceStore(str(tmp_path))


def _stamp_version(store, value):
    """直接改写版本记录，模拟历史版本数据库。"""
    store._conn.execute(
        "INSERT OR REPLACE INTO schema_version (k, v) VALUES ('schema_version', ?)", (str(value),)
    )
    store._conn.commit()


def test_schema_version_recorded(tmp_path):
    store = _make_store(tmp_path)
    assert store.get_schema_version() == str(DATA_VERSION)
    assert store.db_path == Path(tmp_path) / ".loglayer" / "workspace.db"
    store.close()


def test_kv_get_put_delete(tmp_path):
    store = _make_store(tmp_path)
    assert store.get("layout") is None
    assert store.put("layout", '{"grid": 1}') is True
    assert store.get("layout") == '{"grid": 1}'
    # 覆盖写
    assert store.put("layout", '{"grid": 2}') is True
    assert store.get("layout") == '{"grid": 2}'
    assert store.delete("layout") is True
    assert store.get("layout") is None
    store.close()


def test_file_history_upsert_and_get(tmp_path):
    store = _make_store(tmp_path)
    store.upsert_file(
        {"path": "/a/b.log", "name": "b.log", "size": 10, "layers": [{"id": "h1"}], "wasOpen": True}
    )
    store.upsert_file(
        {"path": "/a/c.log", "name": "c.log", "size": 5, "layers": [], "wasOpen": False}
    )

    files = store.get_files()
    assert len(files) == 2
    by_path = {f["path"]: f for f in files}
    assert by_path["/a/b.log"]["name"] == "b.log"
    assert by_path["/a/b.log"]["layers"] == [{"id": "h1"}]
    assert by_path["/a/b.log"]["wasOpen"] is True
    assert by_path["/a/c.log"]["wasOpen"] is False

    # upsert 覆盖旧条目
    store.upsert_file(
        {"path": "/a/b.log", "name": "b.log", "size": 99, "layers": [], "wasOpen": False}
    )
    files = store.get_files()
    assert len(files) == 2
    b = [f for f in files if f["path"] == "/a/b.log"][0]
    assert b["size"] == 99 and b["wasOpen"] is False
    store.close()


def test_set_was_open(tmp_path):
    store = _make_store(tmp_path)
    store.upsert_file({"path": "/a/x.log", "name": "x.log", "size": 1, "layers": [], "wasOpen": True})
    store.set_was_open("/a/x.log", False)
    files = store.get_files()
    assert files[0]["wasOpen"] is False
    store.close()


def test_set_files_atomic(tmp_path):
    store = _make_store(tmp_path)
    files = [
        {"path": "/a/1.log", "name": "1.log", "size": 1, "layers": [], "wasOpen": True},
        {"path": "/a/2.log", "name": "2.log", "size": 2, "layers": [{"id": "l2"}], "wasOpen": True},
    ]
    assert store.set_files(files) is True
    out = store.get_files()
    assert len(out) == 2
    assert {f["path"] for f in out} == {"/a/1.log", "/a/2.log"}
    store.close()


def test_kv_and_files_share_single_db(tmp_path):
    store = _make_store(tmp_path)
    store.put("layout", "L")
    store.upsert_file({"path": "/a/f.log", "name": "f.log", "size": 3, "layers": [], "wasOpen": True})
    # 重开同一 db，数据持久
    store.close()
    store2 = WorkspaceStore(str(tmp_path))
    assert store2.get("layout") == "L"
    assert len(store2.get_files()) == 1
    store2.close()


def test_delete_file_removes_row(tmp_path):
    """delete_file 删除存在条目后 get_files 不再包含该路径。"""
    store = _make_store(tmp_path)
    store.upsert_file({"path": "/a/1.log", "name": "1.log", "size": 1, "layers": [], "wasOpen": True})
    store.upsert_file({"path": "/a/2.log", "name": "2.log", "size": 2, "layers": [], "wasOpen": True})
    assert store.delete_file("/a/1.log") is True
    paths = {f["path"] for f in store.get_files()}
    assert "/a/1.log" not in paths
    assert "/a/2.log" in paths
    store.close()


def test_delete_file_idempotent_missing(tmp_path):
    """delete_file 对不存在的路径幂等返回 True 且不报错。"""
    store = _make_store(tmp_path)
    store.upsert_file({"path": "/a/1.log", "name": "1.log", "size": 1, "layers": [], "wasOpen": True})
    assert store.delete_file("/nonexistent.log") is True
    assert len(store.get_files()) == 1
    store.close()


# ---------- 数据版本化（add-workspace-data-versioning 验收） ----------


def _seed_user_data(store):
    store.put("layout", '{"grid": 1}')
    store.put("settings.theme", "dark")
    store.upsert_file({"path": "/a/f.log", "name": "f.log", "size": 3, "layers": [], "wasOpen": True})


def test_version_mismatch_resets_all_data(tmp_path):
    """旧版本库：ensure_data_version 清空 kv 与 files，并推进版本戳。"""
    store = _make_store(tmp_path)
    _seed_user_data(store)
    _stamp_version(store, DATA_VERSION - 1)

    store.ensure_data_version()

    assert store.get("layout") is None, "重置后 kv 应为空"
    assert store.get("settings.theme") is None
    assert store.get_files() == [], "重置后文件历史应为空"
    assert store.get_schema_version() == str(DATA_VERSION)
    store.close()


def test_version_match_keeps_data_untouched(tmp_path):
    """版本一致：不做任何清理，用户数据原样保留。"""
    store = _make_store(tmp_path)
    _seed_user_data(store)

    store.ensure_data_version()

    assert store.get("layout") == '{"grid": 1}'
    assert len(store.get_files()) == 1
    assert store.get_schema_version() == str(DATA_VERSION)
    store.close()


def test_missing_version_record_triggers_reset_on_reopen(tmp_path):
    """无版本记录（遗留库）：构造函数自动重置并写入当前版本。"""
    store = _make_store(tmp_path)
    _seed_user_data(store)
    # 模拟遗留库：删除版本记录
    store._conn.execute("DELETE FROM schema_version")
    store._conn.commit()
    store.close()

    store2 = WorkspaceStore(str(tmp_path))
    assert store2.get("layout") is None
    assert store2.get_files() == []
    assert store2.get_schema_version() == str(DATA_VERSION)

    # 重置后新写入的数据在下次打开时保留（版本一致不再误清）
    store2.put("layout", "NEW")
    store2.close()
    store3 = WorkspaceStore(str(tmp_path))
    assert store3.get("layout") == "NEW"
    store3.close()


def test_reset_is_atomic(tmp_path):
    """重置原子性：kv 与 files 同时清空，版本戳同事务推进。"""
    store = _make_store(tmp_path)
    _seed_user_data(store)
    _stamp_version(store, DATA_VERSION - 1)

    store.ensure_data_version()

    # 单连接内直接核对两表与版本戳的一致终态
    kv_count = store._conn.execute("SELECT COUNT(*) FROM kv").fetchone()[0]
    files_count = store._conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
    version = store._conn.execute(
        "SELECT v FROM schema_version WHERE k='schema_version'"
    ).fetchone()[0]
    assert (kv_count, files_count) == (0, 0)
    assert int(version) == DATA_VERSION
    store.close()
