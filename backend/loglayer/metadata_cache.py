"""SQLite 元数据缓存：行偏移索引持久化。

将行偏移索引分块 + zlib 压缩后存储为 BLOB，适配千万行级超大日志。
缓存以文件哈希（前 8KB + 后 8KB + size）作为有效性判据，文件变更自动失效。
"""
from __future__ import annotations

import hashlib
import sqlite3
import struct
import threading
import time
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# 每块偏移数量（100 万行/块）。千万行文件约 10 块，单块压缩后体积可控。
CHUNK_ROWS = 1_000_000


@dataclass(frozen=True)
class CachedFileIndex:
    """已扫描文件的缓存索引数据。"""

    file_hash: str  # 文件哈希，用于变更检测
    line_count: int
    offsets_blob: bytes  # 分块压缩后的偏移数组
    file_size: int


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

    def close(self) -> None:
        """关闭数据库连接（切换工作区时调用）。"""
        with self._lock:
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
            self._conn.commit()

    # ---------------------------------------------------------------
    # 基础读写
    # ---------------------------------------------------------------

    def get(self, file_path: str) -> Optional[CachedFileIndex]:
        """读取缓存条目。

        校验文件哈希；若文件已变更，丢弃旧缓存并返回 None。
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT file_hash, line_count, file_size, offsets_blob FROM file_index_cache WHERE file_path = ?",
                (file_path,),
            ).fetchone()
            if row is None:
                return None

            # 文件变更检测：哈希不一致 → 缓存失效
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

    def put(self, file_path: str, index: CachedFileIndex) -> None:
        """写入缓存条目（覆盖旧条目）。"""
        with self._lock:
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
        """删除单个文件缓存。"""
        with self._lock:
            self._conn.execute("DELETE FROM file_index_cache WHERE file_path = ?", (file_path,))
            self._conn.commit()

    def clear_all(self) -> None:
        """清空全部缓存。"""
        with self._lock:
            self._conn.execute("DELETE FROM file_index_cache")
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
    # LRU 淘汰
    # ---------------------------------------------------------------

    def set_cache_size(self, cache_size_bytes: int) -> None:
        """更新缓存字节上限并触发淘汰。"""
        self._cache_size_bytes = cache_size_bytes
        self.enforce_limit(protected=set())

    def get_entries(self) -> list:
        """返回全部缓存条目信息：(file_path, offset_bytes, last_access)。"""
        with self._lock:
            rows = self._conn.execute(
                "SELECT file_path, offset_bytes, last_access FROM file_index_cache"
            ).fetchall()
            return [(r[0], r[1], r[2]) for r in rows]

    def total_bytes(self) -> int:
        with self._lock:
            row = self._conn.execute("SELECT COALESCE(SUM(offset_bytes), 0) FROM file_index_cache").fetchone()
            return int(row[0]) if row else 0

    def enforce_limit(self, protected: Optional[set] = None) -> None:
        """按字节上限执行 LRU 淘汰。

        - 软上限：总占用超过上限时，从最久未用开始淘汰
        - 硬下限：至少保留 1 个文件（单文件超上限仍缓存）
        - 豁免：`protected` 中的文件（当前编辑中）不参与淘汰
        """
        if self._cache_size_bytes is None:
            return
        protected = protected or set()
        entries = self.get_entries()
        if not entries:
            return
        entries.sort(key=lambda e: e[2])  # 最久未用在前

        total = sum(e[1] for e in entries)
        kept = len(entries)
        for file_path, size, _ in entries:
            if total <= self._cache_size_bytes:
                break
            if file_path in protected:
                continue
            # 硬下限：至少保留 1 个文件
            if kept <= 1:
                break
            self.invalidate(file_path)
            total -= size
            kept -= 1
