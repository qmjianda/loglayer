"""SQLite 元数据缓存：行偏移索引持久化。

将行偏移索引分块 + zlib 压缩后存储为 BLOB，适配千万行级超大日志。
缓存以文件哈希（前 8KB + 后 8KB + size）作为有效性判据，文件变更自动失效。

除行偏移索引外，还缓存过滤/搜索的计算结果（pipeline_cache / search_cache），
三者共用同一 LRU 字节上限。
"""
from __future__ import annotations

import array
import hashlib
import os
import sqlite3
import struct
import threading
import time
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from cachetools import LRUCache

# 每块偏移数量（100 万行/块）。千万行文件约 10 块，单块压缩后体积可控。
CHUNK_ROWS = 1_000_000


@dataclass(frozen=True)
class CachedFileIndex:
    """已扫描文件的缓存索引数据。"""

    file_hash: str  # 文件哈希，用于变更检测
    line_count: int
    offsets_blob: bytes  # 分块压缩后的偏移数组
    file_size: int


@dataclass(frozen=True)
class CachedPipelineResult:
    """过滤结果缓存：可见行物理行号（None 表示全部可见）。"""

    visible_indices: Optional["array.array"]  # array('I') 或 None


@dataclass(frozen=True)
class CachedSearchResult:
    """搜索匹配缓存：匹配行物理行号。"""

    matches: Optional["array.array"]  # array('I')；None 仅当反序列化遇 0x00 前缀


class SqliteMetadataCache:
    """SQLite 实现：持久化行偏移索引，实现大文件二次打开秒开。

    schema:
        file_index_cache (
            file_path TEXT PRIMARY KEY,
            file_hash TEXT NOT NULL,
            line_count INTEGER NOT NULL,
            file_size INTEGER NOT NULL,
            offsets_blob BLOB NOT NULL,       -- 分块 zlib 压缩的偏移数组
            offset_bytes INTEGER NOT NULL,     -- 未压缩偏移字节数（LRU 计量）
            last_access REAL NOT NULL,         -- LRU 最近访问时间戳
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        pipeline_cache (
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            layers_hash TEXT NOT NULL,
            visible_blob BLOB NOT NULL,        -- 可见行物理行号（含 None 标志）
            data_bytes INTEGER NOT NULL,
            last_access REAL NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (file_path, layers_hash)
        )
        search_cache (
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            query_hash TEXT NOT NULL,
            matches_blob BLOB NOT NULL,        -- 匹配行物理行号（含 None 标志）
            data_bytes INTEGER NOT NULL,
            last_access REAL NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (file_path, query_hash)
        )
    """

    def __init__(self, db_path, cache_size_bytes: int | None = None) -> None:
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._cache_size_bytes = cache_size_bytes
        # check_same_thread=False：索引 worker 线程与主线程都会读写缓存
        self._conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        self._lock = threading.RLock()
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()
        # 内存热缓存：反序列化后的偏移数组（key=file_path），避免大文件二次打开时
        # 重复读磁盘 BLOB（WSL2 drvfs 上 40MB BLOB 读取可达数秒）。
        # 与 SQLite 层共用 cache_size_bytes 字节预算：getsizeof 按 array('Q') 实际字节计。
        self._offsets_mem = LRUCache(
            maxsize=64, getsizeof=self._offsets_sizeof
        )

    @staticmethod
    def _offsets_sizeof(value) -> int:
        return len(value[0]) * 8 if value and value[0] is not None else 0

    def close(self) -> None:
        """关闭数据库连接（切换工作区时调用）。"""
        with self._lock:
            self._offsets_mem.clear()
            try:
                self._conn.close()
            except Exception:
                pass

    @property
    def db_path(self) -> Path:
        return self._db_path

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS file_index_cache (
                    file_path TEXT PRIMARY KEY,
                    file_hash TEXT NOT NULL,
                    line_count INTEGER NOT NULL,
                    file_size INTEGER NOT NULL,
                    offsets_blob BLOB NOT NULL,
                    offset_bytes INTEGER NOT NULL,
                    last_access REAL NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pipeline_cache (
                    file_path TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    layers_hash TEXT NOT NULL,
                    visible_blob BLOB NOT NULL,
                    data_bytes INTEGER NOT NULL,
                    last_access REAL NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (file_path, layers_hash)
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS search_cache (
                    file_path TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    query_hash TEXT NOT NULL,
                    matches_blob BLOB NOT NULL,
                    data_bytes INTEGER NOT NULL,
                    last_access REAL NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (file_path, query_hash)
                )
                """
            )
            self._conn.commit()

    # ---------------------------------------------------------------
    # 基础读写
    # ---------------------------------------------------------------

    def get(self, file_path: str) -> Optional[CachedFileIndex]:
        """读取缓存条目。

        校验文件是否变更：优先用文件大小对比（O(1)），大小一致即命中，
        无需重算 SHA-256；仅当大小不一致时才重算哈希复核（内容被等大小改写）。
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT file_hash, line_count, file_size, offsets_blob FROM file_index_cache WHERE file_path = ?",
                (file_path,),
            ).fetchone()
            if row is None:
                return None

            # 文件变更检测：先比大小（廉价），再在需要时哈希复核
            try:
                current_size = os.path.getsize(file_path)
            except OSError:
                self.invalidate(file_path)
                return None
            if current_size != row[2]:
                current_hash = self.compute_file_hash(file_path)
                if current_hash != row[0]:
                    self.invalidate(file_path)
                    return None

            # 更新 LRU 访问时间
            self._conn.execute(
                "UPDATE file_index_cache SET last_access = ? WHERE file_path = ?",
                (time.time(), file_path),
            )
            self._conn.commit()

            return CachedFileIndex(
                file_hash=row[0],
                line_count=row[1],
                file_size=row[2],
                offsets_blob=row[3],
            )

    def cache_offsets_memory(self, file_path: str, offsets) -> None:
        """索引完成后立即写入内存热缓存，供同进程二次打开命中。

        SQLite 异步落盘可能需数秒（序列化+压缩），此方法让内存层先就绪，
        避免"刚索引完立刻再打开"时因磁盘未落盘而重复索引。
        单条目超过字节预算时静默跳过（回退 SQLite），不中断索引流程。
        """
        with self._lock:
            try:
                size = os.path.getsize(file_path)
            except OSError:
                return
            try:
                self._offsets_mem[file_path] = (offsets, size)
            except ValueError:
                pass

    def get_offsets(self, file_path: str) -> Optional[array.array]:
        """读取已反序列化的偏移数组（array('Q')）。

        内存热缓存优先（同进程二次打开零磁盘 IO），命中时仍校验文件大小，
        文件变更即失效；未命中则从 SQLite 读 BLOB 并反序列化，结果存入内存缓存。
        """
        with self._lock:
            mem = self._offsets_mem.get(file_path)
            if mem is not None:
                mem_offsets, mem_size = mem
                try:
                    size_ok = os.path.getsize(file_path) == mem_size
                except OSError:
                    size_ok = False
                if not size_ok:
                    self._offsets_mem.pop(file_path, None)
                    return None
                return mem_offsets

            entry = self.get(file_path)
            if entry is None:
                return None
            offsets = array.array("Q", self.deserialize_offsets(entry.offsets_blob))
            try:
                self._offsets_mem[file_path] = (offsets, entry.file_size)
            except ValueError:
                pass
            return offsets

    def put(self, file_path: str, index: CachedFileIndex) -> None:
        """写入缓存条目（覆盖旧条目）。"""
        with self._lock:
            # 写库后内存热缓存失效（下次 get 重新反序列化新 BLOB）
            self._offsets_mem.pop(file_path, None)
            offset_bytes = len(index.offsets_blob)
            self._conn.execute(
                """INSERT OR REPLACE INTO file_index_cache
                   (file_path, file_hash, line_count, file_size, offsets_blob, offset_bytes, last_access)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    file_path,
                    index.file_hash,
                    index.line_count,
                    index.file_size,
                    index.offsets_blob,
                    offset_bytes,
                    time.time(),
                ),
            )
            self._conn.commit()

    def invalidate(self, file_path: str) -> None:
        """删除单个文件的所有缓存（索引 + 过滤结果 + 搜索结果）。

        文件变更（哈希不匹配）或显式清理时，其派生结果缓存一并失效。
        """
        with self._lock:
            self._offsets_mem.pop(file_path, None)
            for table in ("file_index_cache", "pipeline_cache", "search_cache"):
                self._conn.execute(
                    f"DELETE FROM {table} WHERE file_path = ?", (file_path,)
                )
            self._conn.commit()

    def clear_all(self) -> None:
        """清空全部缓存（三张表）。"""
        with self._lock:
            self._offsets_mem.clear()
            for table in ("file_index_cache", "pipeline_cache", "search_cache"):
                self._conn.execute(f"DELETE FROM {table}")
            self._conn.commit()

    # ---------------------------------------------------------------
    # 过滤结果缓存（pipeline_cache）
    # ---------------------------------------------------------------

    def get_pipeline(
        self, file_path: str, layers_hash: str
    ) -> Optional[CachedPipelineResult]:
        """读取过滤结果缓存。

        校验文件哈希；若文件已变更或未命中返回 None。
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT file_hash, visible_blob FROM pipeline_cache WHERE file_path = ? AND layers_hash = ?",
                (file_path, layers_hash),
            ).fetchone()
            if row is None:
                return None

            current_hash = self.compute_file_hash(file_path)
            if current_hash != row[0]:
                self._conn.execute(
                    "DELETE FROM pipeline_cache WHERE file_path = ? AND layers_hash = ?",
                    (file_path, layers_hash),
                )
                self._conn.commit()
                return None

            self._conn.execute(
                "UPDATE pipeline_cache SET last_access = ? WHERE file_path = ? AND layers_hash = ?",
                (time.time(), file_path, layers_hash),
            )
            self._conn.commit()
            return CachedPipelineResult(
                visible_indices=self.deserialize_indices(row[1])
            )

    def put_pipeline(
        self, file_path: str, file_hash: str, layers_hash: str, visible_indices
    ) -> None:
        """写入过滤结果缓存（覆盖旧条目）。"""
        with self._lock:
            blob = self.serialize_indices(visible_indices)
            self._conn.execute(
                """INSERT OR REPLACE INTO pipeline_cache
                   (file_path, file_hash, layers_hash, visible_blob, data_bytes, last_access)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (file_path, file_hash, layers_hash, blob, len(blob), time.time()),
            )
            self._conn.commit()

    # ---------------------------------------------------------------
    # 搜索结果缓存（search_cache）
    # ---------------------------------------------------------------

    def get_search(
        self, file_path: str, query_hash: str
    ) -> Optional[CachedSearchResult]:
        """读取搜索结果缓存。

        校验文件哈希；若文件已变更或未命中返回 None。
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT file_hash, matches_blob FROM search_cache WHERE file_path = ? AND query_hash = ?",
                (file_path, query_hash),
            ).fetchone()
            if row is None:
                return None

            current_hash = self.compute_file_hash(file_path)
            if current_hash != row[0]:
                self._conn.execute(
                    "DELETE FROM search_cache WHERE file_path = ? AND query_hash = ?",
                    (file_path, query_hash),
                )
                self._conn.commit()
                return None

            self._conn.execute(
                "UPDATE search_cache SET last_access = ? WHERE file_path = ? AND query_hash = ?",
                (time.time(), file_path, query_hash),
            )
            self._conn.commit()
            return CachedSearchResult(matches=self.deserialize_indices(row[1]))

    def put_search(
        self, file_path: str, file_hash: str, query_hash: str, matches
    ) -> None:
        """写入搜索结果缓存（覆盖旧条目）。"""
        with self._lock:
            blob = self.serialize_indices(matches)
            self._conn.execute(
                """INSERT OR REPLACE INTO search_cache
                   (file_path, file_hash, query_hash, matches_blob, data_bytes, last_access)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (file_path, file_hash, query_hash, blob, len(blob), time.time()),
            )
            self._conn.commit()

    # ---------------------------------------------------------------
    # 文件哈希校验（前 8KB + 后 8KB + size）
    # ---------------------------------------------------------------

    @staticmethod
    def compute_file_hash(file_path: str) -> str:
        """快速哈希：读前 8KB + 后 8KB + 文件大小，兼顾速度与敏感度。"""
        path = Path(file_path)
        if not path.exists():
            return ""
        size = path.stat().st_size
        hasher = hashlib.sha256()
        hasher.update(str(size).encode())
        with open(path, "rb") as f:
            hasher.update(f.read(8192))
            if size > 8192:
                f.seek(max(0, size - 8192))
                hasher.update(f.read(8192))
        return hasher.hexdigest()

    # ---------------------------------------------------------------
    # 偏移数组 分块序列化 + zlib 压缩
    # ---------------------------------------------------------------

    @staticmethod
    def serialize_offsets(offsets) -> bytes:
        """将偏移数组分块并 zlib 压缩，返回单块 BLOB。

        格式：4 字节块数 N，随后 N × (4 字节块长 + 压缩数据)。
        """
        chunks = []
        total = len(offsets)
        for i in range(0, total, CHUNK_ROWS):
            chunk = offsets[i : i + CHUNK_ROWS]
            packed = struct.pack(f"<{len(chunk)}Q", *chunk)
            chunks.append(zlib.compress(packed))
        return SqliteMetadataCache._pack_chunks(chunks)

    @staticmethod
    def deserialize_offsets(blob: bytes) -> list:
        """解压并合并所有块，还原完整偏移数组。"""
        chunks = SqliteMetadataCache._unpack_chunks(blob)
        offsets = []
        for data in chunks:
            packed = zlib.decompress(data)
            count = len(packed) // 8
            offsets.extend(struct.unpack(f"<{count}Q", packed))
        return list(offsets)

    @staticmethod
    def _pack_chunks(chunks: list) -> bytes:
        out = struct.pack("<I", len(chunks))
        for c in chunks:
            out += struct.pack("<I", len(c)) + c
        return out

    @staticmethod
    def _unpack_chunks(blob: bytes) -> list:
        (count,) = struct.unpack_from("<I", blob, 0)
        chunks = []
        off = 4
        for _ in range(count):
            (length,) = struct.unpack_from("<I", blob, off)
            off += 4
            chunks.append(blob[off : off + length])
            off += length
        return chunks

    # ---------------------------------------------------------------
    # 行号数组 分块序列化（None 表示全部可见）
    # ---------------------------------------------------------------

    @staticmethod
    def serialize_indices(indices) -> bytes:
        """序列化行号数组；None（全部可见）用 0x00 前缀区分空数组。"""
        if indices is None:
            return b"\x00"
        return b"\x01" + SqliteMetadataCache.serialize_offsets(indices)

    @staticmethod
    def deserialize_indices(blob: bytes):
        """还原行号数组；返回 None（全部可见）或 array('I')。"""
        if not blob or blob[0] == 0:
            return None
        return array.array("I", SqliteMetadataCache.deserialize_offsets(blob[1:]))

    # ---------------------------------------------------------------
    # LRU 淘汰
    # ---------------------------------------------------------------

    def set_cache_size(self, cache_size_bytes: int) -> None:
        """更新缓存字节上限（内存热缓存 + SQLite 两层共用）并触发淘汰。"""
        self._cache_size_bytes = cache_size_bytes
        with self._lock:
            # 重建字节上限 LRU，并迁移仍符合新预算的内存条目（超限条目被淘汰）
            old_mem = self._offsets_mem
            self._offsets_mem = LRUCache(
                maxsize=cache_size_bytes, getsizeof=self._offsets_sizeof,
            )
            for key, value in old_mem.items():
                try:
                    self._offsets_mem[key] = value
                except ValueError:
                    pass
        self.enforce_limit(protected=set())

    def get_entries(self) -> list:
        """返回 file_index_cache 条目信息：(file_path, offset_bytes, last_access)。"""
        with self._lock:
            rows = self._conn.execute(
                "SELECT file_path, offset_bytes, last_access FROM file_index_cache"
            ).fetchall()
            return [(r[0], r[1], r[2]) for r in rows]

    def _all_entries(self) -> list:
        """全部三张表的 LRU 条目：(table, key1, key2, data_bytes, last_access)。"""
        with self._lock:
            entries = []
            for r in self._conn.execute(
                "SELECT file_path, offset_bytes, last_access FROM file_index_cache"
            ):
                entries.append(("file", r[0], None, r[1], r[2]))
            for r in self._conn.execute(
                "SELECT file_path, layers_hash, data_bytes, last_access FROM pipeline_cache"
            ):
                entries.append(("pipeline", r[0], r[1], r[2], r[3]))
            for r in self._conn.execute(
                "SELECT file_path, query_hash, data_bytes, last_access FROM search_cache"
            ):
                entries.append(("search", r[0], r[1], r[2], r[3]))
            return entries

    def _delete_entry(self, table: str, key1: str, key2: Optional[str] = None) -> None:
        with self._lock:
            if table == "file":
                self._conn.execute(
                    "DELETE FROM file_index_cache WHERE file_path = ?", (key1,)
                )
            elif table == "pipeline":
                self._conn.execute(
                    "DELETE FROM pipeline_cache WHERE file_path = ? AND layers_hash = ?",
                    (key1, key2),
                )
            else:
                self._conn.execute(
                    "DELETE FROM search_cache WHERE file_path = ? AND query_hash = ?",
                    (key1, key2),
                )
            self._conn.commit()

    def total_bytes(self) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT COALESCE(SUM(offset_bytes), 0) FROM file_index_cache"
            ).fetchone()
            return int(row[0]) if row else 0

    def enforce_limit(self, protected: Optional[set] = None) -> None:
        """按字节上限执行 LRU 淘汰（跨三张表）。

        - 软上限：总占用超过上限时，从最久未用开始淘汰
        - 硬下限：至少保留 1 个条目（单文件超上限仍缓存）
        - 豁免：`protected` 中的文件（当前编辑中）不参与淘汰
        """
        if self._cache_size_bytes is None:
            return
        protected = protected or set()
        entries = self._all_entries()
        if not entries:
            return
        entries.sort(key=lambda e: e[4])  # 最久未用在前

        total = sum(e[3] for e in entries)
        kept = len(entries)
        for table, key1, key2, size, _ in entries:
            if total <= self._cache_size_bytes:
                break
            if key1 in protected:
                continue
            # 硬下限：至少保留 1 个条目
            if kept <= 1:
                break
            self._delete_entry(table, key1, key2)
            total -= size
            kept -= 1
