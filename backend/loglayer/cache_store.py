"""统一计算结果缓存层：内存 LRU（热） + SQLite（冷）两级路由。

- 过滤结果：key = (file_path, layers_hash) → visible_indices（array('I') 或 None=全部可见）
- 搜索结果：key = (file_path, query_hash) → matches（array('I') 物理行号）
- 命中统计按来源（内存 / SQLite / 计算）记录，供诊断接口查询。
- 内存条目附带写入时 file_hash，命中时校验，文件变更即失效（宁可 miss 不可 stale）。
"""
from __future__ import annotations

import array
import threading

from cachetools import LRUCache

from .metadata_cache import SqliteMetadataCache

_MISS = object()


class _MemCache:
    """线程安全的内存 LRU，按字节预算淘汰；超大条目拒绝入内存（仅落 SQLite）。"""

    def __init__(self, maxsize: int, max_bytes: int):
        self._max_bytes = max_bytes
        self._lock = threading.Lock()
        # 字节模式：maxsize 即字节上限（getsizeof 提供每条目字节数）
        self._cache: LRUCache = LRUCache(
            maxsize=max_bytes, getsizeof=lambda v: _data_size(v[1])
        )

    def get(self, key):
        with self._lock:
            try:
                return self._cache[key]
            except KeyError:
                return None

    def put(self, key, value, size: int) -> bool:
        if size > self._max_bytes:
            return False
        with self._lock:
            try:
                self._cache[key] = value
            except ValueError:
                return False
        return True

    def set_budget(self, max_bytes: int) -> None:
        """调整字节预算；重建 LRU 并迁移仍符合新预算的条目。"""
        with self._lock:
            self._max_bytes = max_bytes
            old = self._cache
            self._cache = LRUCache(
                maxsize=max_bytes, getsizeof=lambda v: _data_size(v[1])
            )
            for k, v in old.items():
                try:
                    self._cache[k] = v
                except ValueError:
                    pass

    def drop(self, predicate) -> None:
        with self._lock:
            for k in [k for k in list(self._cache) if predicate(k)]:
                try:
                    del self._cache[k]
                except KeyError:
                    pass

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


def _data_size(data) -> int:
    if data is None:
        return 1
    try:
        return data.buffer_info()[1] * data.itemsize
    except AttributeError:
        return len(data) * 4


class CacheStore:
    """过滤/搜索结果统一缓存：内存 LRU 承接热数据，SQLite 持久化冷数据。"""

    def __init__(
        self,
        sqlite_cache: SqliteMetadataCache,
        memory_maxsize: int = 16,
        memory_max_bytes: int = 4 * 1024 * 1024,
    ):
        self._sqlite = sqlite_cache
        self._pipeline_mem = _MemCache(memory_maxsize, memory_max_bytes)
        self._search_mem = _MemCache(memory_maxsize, memory_max_bytes)
        self._stats = {
            "pipeline": {"memory_hit": 0, "sqlite_hit": 0, "computed": 0},
            "search": {"memory_hit": 0, "sqlite_hit": 0, "computed": 0},
        }
        self._lock = threading.Lock()

    def rebind(self, sqlite_cache: SqliteMetadataCache) -> None:
        """工作区切换时更换 SQLite 后端并清空内存热数据。"""
        self._sqlite = sqlite_cache
        self._pipeline_mem.clear()
        self._search_mem.clear()

    def set_memory_budget(self, memory_max_bytes: int) -> None:
        """调整过滤/搜索内存层字节预算（随 cache_size_mb 联动）。"""
        self._pipeline_mem.set_budget(memory_max_bytes)
        self._search_mem.set_budget(memory_max_bytes)

    # ---------------------------------------------------------------
    # 过滤结果缓存
    # ---------------------------------------------------------------

    def get_pipeline(self, file_path: str, layers_hash: str) -> tuple[bool, "array.array | None"]:
        """查过滤结果缓存。命中返回 (True, visible_indices)，未命中返回 (False, None)。"""
        key = (file_path, layers_hash)
        entry = self._pipeline_mem.get(key)
        if entry is not None:
            file_hash, value = entry
            if SqliteMetadataCache.compute_file_hash(file_path) == file_hash:
                self._bump("pipeline", "memory_hit")
                return True, value
            self._pipeline_mem.drop(lambda k: k == key)
        res = self._sqlite.get_pipeline(file_path, layers_hash)
        if res is not None:
            self._bump("pipeline", "sqlite_hit")
            self._promote("pipeline", key, res.visible_indices)
            return True, res.visible_indices
        return False, None

    def put_pipeline(self, file_path: str, layers_hash: str, visible_indices) -> None:
        """写入过滤结果缓存（内存 + SQLite），并计入"实际计算"来源统计。"""
        file_hash = SqliteMetadataCache.compute_file_hash(file_path)
        self._promote("pipeline", (file_path, layers_hash), visible_indices, file_hash)
        self._sqlite.put_pipeline(file_path, file_hash, layers_hash, visible_indices)
        self._bump("pipeline", "computed")

    # ---------------------------------------------------------------
    # 搜索结果缓存
    # ---------------------------------------------------------------

    def get_search(self, file_path: str, query_hash: str):
        """查搜索结果缓存。命中返回 (True, matches)，未命中返回 (False, None)。"""
        key = (file_path, query_hash)
        entry = self._search_mem.get(key)
        if entry is not None:
            file_hash, value = entry
            if SqliteMetadataCache.compute_file_hash(file_path) == file_hash:
                self._bump("search", "memory_hit")
                return True, value
            self._search_mem.drop(lambda k: k == key)
        res = self._sqlite.get_search(file_path, query_hash)
        if res is not None:
            self._bump("search", "sqlite_hit")
            self._promote("search", key, res.matches)
            return True, res.matches
        return False, None

    def put_search(self, file_path: str, query_hash: str, matches) -> None:
        """写入搜索结果缓存（内存 + SQLite），并计入"实际计算"来源统计。"""
        file_hash = SqliteMetadataCache.compute_file_hash(file_path)
        self._promote("search", (file_path, query_hash), matches, file_hash)
        self._sqlite.put_search(file_path, file_hash, query_hash, matches)
        self._bump("search", "computed")

    # ---------------------------------------------------------------
    # 失效 / 统计
    # ---------------------------------------------------------------

    def invalidate(self, file_path: str) -> None:
        """删除单个文件的全部缓存（三张表 + 内存热数据）。"""
        self._sqlite.invalidate(file_path)
        self._pipeline_mem.drop(lambda k: k[0] == file_path)
        self._search_mem.drop(lambda k: k[0] == file_path)

    def clear(self) -> None:
        self._sqlite.clear_all()
        self._pipeline_mem.clear()
        self._search_mem.clear()

    def get_stats(self) -> dict:
        """返回按来源（memory_hit / sqlite_hit / computed）区分的命中统计副本。"""
        with self._lock:
            return {k: dict(v) for k, v in self._stats.items()}

    def _bump(self, kind: str, source: str) -> None:
        with self._lock:
            self._stats[kind][source] += 1

    def _promote(
        self, kind: str, key: tuple, data, file_hash: str | None = None
    ) -> None:
        mem = self._pipeline_mem if kind == "pipeline" else self._search_mem
        if file_hash is None:
            file_hash = SqliteMetadataCache.compute_file_hash(key[0])
        mem.put(key, (file_hash, data), _data_size(data))
