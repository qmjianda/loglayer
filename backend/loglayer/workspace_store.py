"""工作区统一持久化底座：SQLite 单文件存储（`.loglayer/workspace.db`）。

承载工作区级状态（布局、图层、书签、设置、文件历史），统一接口读写，
schema 版本化 + 事务原子写。旧 `.loglayer/config.json` 与 `.loglayer/cache.db`
废弃删除，本底座从全新起点接管（无旧数据迁移）。

schema:
    schema_version (k TEXT PK, v TEXT)      -- 版本记录（为未来升级预留迁移框架）
    kv            (key TEXT PK, value TEXT) -- 通用 KV：layout / bookmarks.<path> / settings 等
    files         (path TEXT PK, ...)       -- 文件历史（原 config.json files[]）

约束：仅依赖标准库 `sqlite3`，无 ORM；工作区 `.loglayer/` 目录随项目走。
"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Optional

SCHEMA_VERSION = "1"


class WorkspaceStore:
    """工作区统一存储：KV + 文件历史，事务原子写，schema 版本记录。"""

    def __init__(self, workspace_dir, schema_version: str = SCHEMA_VERSION) -> None:
        self.root = Path(workspace_dir)
        loglayer_dir = self.root / ".loglayer"
        loglayer_dir.mkdir(parents=True, exist_ok=True)
        self._db_path = loglayer_dir / "workspace.db"
        # check_same_thread=False：REST worker 线程与主线程都会读写
        self._conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        self._lock = threading.RLock()
        # isolation_level=None：关闭隐式事务，显式 BEGIN/COMMIT 控制原子性
        self._conn.isolation_level = None
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema(schema_version)

    @property
    def db_path(self) -> Path:
        return self._db_path

    def close(self) -> None:
        """关闭数据库连接（切换工作区时调用）。"""
        with self._lock:
            try:
                self._conn.close()
            except Exception:
                pass

    def _init_schema(self, schema_version: str) -> None:
        with self._lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_version (
                    k TEXT PRIMARY KEY,
                    v TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS kv (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS files (
                    path TEXT PRIMARY KEY,
                    name TEXT NOT NULL DEFAULT '',
                    size INTEGER NOT NULL DEFAULT 0,
                    layers TEXT NOT NULL DEFAULT '[]',
                    was_open INTEGER NOT NULL DEFAULT 1,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            self._conn.execute(
                "INSERT OR REPLACE INTO schema_version (k, v) VALUES ('schema_version', ?)",
                (schema_version,),
            )
            self._conn.commit()

    # ---------------------------------------------------------------
    # schema 版本
    # ---------------------------------------------------------------

    def get_schema_version(self) -> str:
        with self._lock:
            row = self._conn.execute(
                "SELECT v FROM schema_version WHERE k = 'schema_version'"
            ).fetchone()
            return row[0] if row else ""

    # ---------------------------------------------------------------
    # KV 读写（原子）
    # ---------------------------------------------------------------

    def get(self, key: str) -> Optional[str]:
        """读取一个 KV 值；不存在返回 None。"""
        with self._lock:
            row = self._conn.execute(
                "SELECT value FROM kv WHERE key = ?", (key,)
            ).fetchone()
            return row[0] if row else None

    def put(self, key: str, value: str) -> bool:
        """原子写一个 KV 值（INSERT OR REPLACE）。"""
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", (key, value)
            )
            self._conn.commit()
            return True

    def delete(self, key: str) -> bool:
        """删除一个 KV 键。"""
        with self._lock:
            self._conn.execute("DELETE FROM kv WHERE key = ?", (key,))
            self._conn.commit()
            return True

    # ---------------------------------------------------------------
    # 文件历史读写（原 config.json files[]）
    # ---------------------------------------------------------------

    def get_files(self) -> list:
        """读取全部文件历史，返回 dict 列表（与旧 config.json files[] 同构）。"""
        with self._lock:
            rows = self._conn.execute(
                "SELECT path, name, size, layers, was_open FROM files"
            ).fetchall()
        files = []
        for path, name, size, layers, was_open in rows:
            try:
                parsed_layers = json.loads(layers) if layers else []
            except (ValueError, TypeError):
                parsed_layers = []
            files.append(
                {
                    "path": path,
                    "name": name,
                    "size": size,
                    "layers": parsed_layers,
                    "wasOpen": bool(was_open),
                }
            )
        return files

    @staticmethod
    def _file_row(entry: dict) -> tuple:
        """将文件历史条目转为 files 表的一行参数。"""
        return (
            entry.get("path", ""),
            entry.get("name", ""),
            int(entry.get("size", 0) or 0),
            json.dumps(entry.get("layers", []), ensure_ascii=False),
            1 if entry.get("wasOpen", True) else 0,
        )

    def upsert_file(self, entry: dict) -> bool:
        """写入单条文件历史（覆盖旧条目）。"""
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO files (path, name, size, layers, was_open) VALUES (?, ?, ?, ?, ?)",
                self._file_row(entry),
            )
            self._conn.commit()
            return True

    def set_was_open(self, path: str, was_open: bool) -> bool:
        """更新文件历史中的 wasOpen 标记（文件当前是否在编辑区）。"""
        with self._lock:
            self._conn.execute(
                "UPDATE files SET was_open = ? WHERE path = ?",
                (1 if was_open else 0, path),
            )
            self._conn.commit()
            return True

    def set_files(self, files: list) -> bool:
        """事务内批量写入文件历史：要么全部生效，要么全部不生效。"""
        with self._lock:
            try:
                self._conn.execute("BEGIN")
                for entry in files:
                    self._conn.execute(
                        "INSERT OR REPLACE INTO files (path, name, size, layers, was_open) VALUES (?, ?, ?, ?, ?)",
                        self._file_row(entry),
                    )
                self._conn.commit()
                return True
            except Exception:
                self._conn.rollback()
                return False
