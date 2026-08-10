"""通用 LRU 缓存结构（线程安全，backed by cachetools.LRUCache）。"""

import threading

from cachetools import LRUCache as _CachetoolsLRU


class LRUCache:
    """LRU cache with max size limit. Thread-safe, backed by cachetools.LRUCache."""

    def __init__(self, max_size: int = 5000):
        self.max_size = max_size
        self._cache = _CachetoolsLRU(maxsize=max_size)
        self._lock = threading.Lock()

    def __contains__(self, key):
        with self._lock:
            return key in self._cache

    def __getitem__(self, key):
        with self._lock:
            return self._cache[key]

    def __setitem__(self, key, value):
        with self._lock:
            self._cache[key] = value

    def __len__(self):
        with self._lock:
            return len(self._cache)

    def clear(self):
        with self._lock:
            self._cache.clear()

    def get(self, key, default=None):
        with self._lock:
            try:
                return self._cache[key]
            except KeyError:
                return default

    def pop(self, key, default=None):
        with self._lock:
            return self._cache.pop(key, default)

    def items(self):
        """Snapshot of (key, value) pairs, safe to use outside the lock."""
        with self._lock:
            return list(self._cache.items())
