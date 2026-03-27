"""
Cache Manager - Unified caching with LRU eviction and TTL support.
"""

from collections import OrderedDict
from typing import Any, Optional, Dict
import time
import threading


class CacheManager:
    """
    Unified caching with TTL and LRU eviction.

    Replaces multiple custom cache implementations in bridge.py.
    """

    def __init__(self, max_size: int = 5000, stats_ttl: int = 300):
        self._stats_cache: Dict[str, tuple[Any, float]] = {}
        self._max_size = max_size
        self._stats_ttl = stats_ttl
        self._lock = threading.Lock()

    def create_rendering_cache(self) -> "RenderingCache":
        return RenderingCache(self._max_size)

    def get_stats(self, config_hash: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if config_hash in self._stats_cache:
                value, timestamp = self._stats_cache[config_hash]
                if time.time() - timestamp < self._stats_ttl:
                    return value
                del self._stats_cache[config_hash]
        return None

    def put_stats(self, config_hash: str, stats: Dict[str, Any]):
        with self._lock:
            self._stats_cache[config_hash] = (stats, time.time())

    def invalidate_stats(self, config_hash: str = None):
        with self._lock:
            if config_hash:
                self._stats_cache.pop(config_hash, None)
            else:
                self._stats_cache.clear()

    def invalidate_rendering(self):
        with self._lock:
            self._render_cache.clear()


class RenderingCache:
    """LRU cache for rendering data."""

    def __init__(self, max_size: int):
        self._store: OrderedDict[str, Any] = OrderedDict()
        self._max_size = max_size

    def __setitem__(self, key: str, value: Any):
        if key in self._store:
            self._store.move_to_end(key)
        elif len(self._store) >= self._max_size:
            self._store.popitem(last=False)
        self._store[key] = value

    def __getitem__(self, key: str) -> Any:
        if key in self._store:
            self._store.move_to_end(key)
            return self._store[key]
        raise KeyError(key)

    def __contains__(self, key: str) -> bool:
        return key in self._store

    def get(self, key: str, default: Any = None) -> Any:
        if key in self._store:
            self._store.move_to_end(key)
            return self._store[key]
        return default

    def clear(self):
        self._store.clear()

    @property
    def _cache(self) -> Dict[str, Any]:
        return dict(self._store)


__all__ = ["CacheManager", "RenderingCache"]
