"""工作区统一持久化底座：SQLite 单文件存储（`.loglayer/workspace.db`）。

承载工作区级状态（布局、图层、书签、设置、文件历史），统一接口读写，
schema 版本化 + 事务原子写。旧 `.loglayer/config.json` 与 `.loglayer/cache.db`
废弃删除，本底座从全新起点接管（无旧数据迁移）。

数据版本化（add-workspace-data-versioning）：启动时由 `ensure_data_version`
比较已存版本与 `DATA_VERSION`，不一致（含无记录）即清空 kv/files 重建并
推进版本戳；一致则原样保留。未来真实迁移在此单一接缝内替换策略。

schema:
    schema_version (k TEXT PK, v TEXT)      -- 数据版本记录（整数，单调递增）
    kv            (key TEXT PK, value TEXT) -- 通用 KV：layout / bookmarks.<path> / settings 等
    files         (path TEXT PK, ...)       -- 文件历史

约束：仅依赖标准库 `sqlite3`，无 ORM；工作区 `.loglayer/` 目录随项目走。
"""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Optional

# 数据版本：持久化格式变更时 +1；不一致触发整体删除重建（开发版策略）。
# 1 为"无版本机制的遗留数据"，天然触发一次重置以清除历史脏数据。
DATA_VERSION = 2


def _as_int(value) -> Optional[int]:
    """版本值安全转 int；非数字（异常/遗留脏值）返回 None 视为不匹配。"""
    try:
        return int(str(value))
    except (ValueError, TypeError):
        return None


class WorkspaceStore:
    """工作区统一存储：KV + 文件历史，事务原子写，数据版本保障。"""

    def __init__(self, workspace_dir) -> None:
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
        self._init_schema()
        # 版本保障单一入口：建表后立即执行（服务就绪前完成，无并发窗口）
        self.ensure_data_version()

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

    def _init_schema(self) -> None:
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
            self._conn.commit()

    # ---------------------------------------------------------------
    # 数据版本保障（单一接缝：未来真实迁移只改这里）
    # ---------------------------------------------------------------

    def ensure_data_version(self) -> None:
        """比较已存数据版本与 DATA_VERSION；不一致即事务内清空重建。

        一致时原样保留用户数据；重置与版本戳推进在同一事务内原子生效，
        中途崩溃则整体回滚，下次启动幂等重做。
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT v FROM schema_version WHERE k = 'schema_version'"
            ).fetchone()
            if row is not None and _as_int(row[0]) == DATA_VERSION:
                return
            old = row[0] if row is not None else "<none>"
            try:
                self._conn.execute("BEGIN")
                self._conn.execute("DELETE FROM kv")
                self._conn.execute("DELETE FROM files")
                self._conn.execute(
                    "INSERT OR REPLACE INTO schema_version (k, v) VALUES ('schema_version', ?)",
                    (str(DATA_VERSION),),
                )
                self._conn.execute("COMMIT")
                print(
                    f"[WorkspaceStore] 数据版本不一致（{old} -> {DATA_VERSION}），"
                    "已重置工作区数据（布局/文件历史/书签/设置）"
                )
            except Exception:
                self._conn.execute("ROLLBACK")
                raise

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

    def delete_file(self, path: str) -> bool:
        """从文件历史中删除单条记录（幂等：不存在也返回 True）。"""
        with self._lock:
            self._conn.execute("DELETE FROM files WHERE path = ?", (path,))
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
