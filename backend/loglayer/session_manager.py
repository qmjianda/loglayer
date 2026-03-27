"""
Session Manager - Manages LogSession lifecycle and state.

This module extracts session management from FileBridge to follow
Single Responsibility Principle. It handles:
- Session creation and lifecycle
- Bookmark persistence
- Layer instance management
- Cache coordination
"""

import json
import hashlib
import array
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List
from loglayer.core import LayerStage, ProcessedLine


class LogSession:
    """
    Represents a single file session with all its state.

    Extracted from bridge.py to follow Single Responsibility Principle.
    Previously part of FileBridge's internal state management.
    """

    def __init__(self, file_id: str, path: str, provider=None):
        self.id = file_id
        self.path = str(path)
        self.provider = provider
        self.file_obj = None
        self.mmap = None
        self._mmap_lock = threading.RLock()  # Thread-safe lock
        self.size = 0
        self.line_offsets = array.array("Q")
        self.visible_indices = None
        self.search_matches = None
        self.layers: List[Any] = []
        self.layer_instances: List[Any] = []
        self.rendering_instances: List[Any] = []
        self.search_config: Optional[Dict[str, Any]] = None
        self.sparse_index = False
        self.sparse_interval = 1
        self.sparse_cache: Dict[int, int] = {}
        self.processing_cache: Dict[str, Any] = {}
        self.rendering_cache: "LRUCache" = None  # Set by CacheManager
        self.workers: Dict[str, Any] = {}

        # Statistics cache - avoid recalculation
        self.stats_cache: Dict[str, Any] = {}
        self.stats_config_hash: str = ""

        # Independent bookmark storage (line_index -> comment)
        self.bookmarks: Dict[int, str] = {}

    @property
    def cache(self):
        """Backward compatibility - combined view of both caches."""
        if self.rendering_cache:
            return {**self.processing_cache, **self.rendering_cache._cache}
        return self.processing_cache

    def close(self, bridge=None):
        """
        Close the session and cleanup resources.

        Args:
            bridge: Optional FileBridge reference for worker retirement
        """
        # First stop all workers
        for name, worker in list(self.workers.items()):
            if bridge:
                bridge._retire_worker(worker)
            else:
                if worker.isRunning():
                    worker.stop()
                    worker.wait()
        self.workers.clear()

        # Use lock to protect mmap closing
        with self._mmap_lock:
            if self.mmap:
                try:
                    self.mmap.close()
                except (OSError, ValueError):
                    pass
                self.mmap = None
            if self.file_obj:
                try:
                    self.file_obj.close()
                except (OSError, ValueError):
                    pass
                self.file_obj = None


class LRUCache:
    """
    LRU Cache implementation for rendering cache.

    Replaces custom implementation in bridge.py with standard library pattern.
    """

    def __init__(self, max_size: int = 5000):
        self.max_size = max_size
        self._cache: Dict[str, Any] = {}
        self._access_order: List[str] = []

    def __setitem__(self, key: str, value: Any):
        if key in self._cache:
            self._access_order.remove(key)
        elif len(self._cache) >= self.max_size:
            lru_key = self._access_order.pop(0)
            del self._cache[lru_key]
        self._cache[key] = value
        self._access_order.append(key)

    def __getitem__(self, key: str) -> Any:
        if key in self._cache:
            self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]
        raise KeyError(key)

    def __contains__(self, key: str) -> bool:
        return key in self._cache

    def __len__(self) -> int:
        return len(self._cache)

    def get(self, key: str, default: Any = None) -> Any:
        if key in self._cache:
            self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]
        return default

    def put(self, key: str, value: Any):
        self[key] = value

    def clear(self):
        self._cache.clear()
        self._access_order.clear()

    @property
    def _cache_dict(self):
        """Expose cache dict for backward compatibility"""
        return self._cache


class SessionManager:
    """
    Manages LogSession lifecycle and state.

    This class follows the Facade pattern, providing a simplified interface
    for session management while delegating to specialized components.
    """

    def __init__(self, registry, emit_signal_fn=None):
        """
        Initialize SessionManager.

        Args:
            registry: LayerRegistry instance
            emit_signal_fn: Optional callback for signal emission
        """
        self._registry = registry
        self._emit_signal = emit_signal_fn
        self._sessions: Dict[str, LogSession] = {}
        self._cache_manager = None  # Set by set_cache_manager

    def set_cache_manager(self, cache_manager):
        """Set the cache manager for all sessions."""
        self._cache_manager = cache_manager
        for session in self._sessions.values():
            if session.rendering_cache is None:
                session.rendering_cache = cache_manager.create_rendering_cache()

    def create_session(self, file_id: str, path: str, provider, size: int) -> LogSession:
        """
        Create a new session for a file.

        Args:
            file_id: Unique session identifier
            path: File path
            provider: Storage provider
            size: File size in bytes

        Returns:
            Created LogSession instance
        """
        session = LogSession(file_id, path, provider)
        session.size = size

        # Attach cache if available
        if self._cache_manager:
            session.rendering_cache = self._cache_manager.create_rendering_cache()

        self._sessions[file_id] = session
        return session

    def get_session(self, file_id: str) -> Optional[LogSession]:
        """Get session by ID."""
        return self._sessions.get(file_id)

    def get_or_raise(self, file_id: str) -> LogSession:
        """Get session or raise KeyError."""
        session = self._sessions.get(file_id)
        if not session:
            raise KeyError(f"Session {file_id} not found")
        return session

    def close_session(self, file_id: str, retire_worker_fn=None) -> bool:
        """
        Close and cleanup a session.

        Args:
            file_id: Session ID to close
            retire_worker_fn: Optional callback to retire workers

        Returns:
            True if session was found and closed
        """
        if file_id not in self._sessions:
            return False

        session = self._sessions[file_id]

        # Close with optional bridge reference
        if retire_worker_fn:
            session.close(retire_worker_fn)
        else:
            session.close()

        del self._sessions[file_id]
        return True

    def close_all(self, retire_worker_fn=None):
        """Close all sessions."""
        for file_id in list(self._sessions.keys()):
            self.close_session(file_id, retire_worker_fn)

    def get_bookmark_file_path(self, file_path: str) -> Optional[Path]:
        """Get the bookmark file path for a given file."""
        if not file_path:
            return None
        file_hash = hashlib.md5(file_path.encode()).hexdigest()[:16]
        return Path(file_path).parent / ".loglayer" / "bookmarks" / f"{file_hash}.json"

    def save_bookmarks(self, file_id: str) -> bool:
        """Save bookmarks for a file to .loglayer/bookmarks/"""
        session = self._sessions.get(file_id)
        if not session or not session.path:
            return False

        bookmark_file = self.get_bookmark_file_path(session.path)
        if not bookmark_file:
            return False

        try:
            bookmark_file.parent.mkdir(parents=True, exist_ok=True)
            with open(bookmark_file, "w", encoding="utf-8") as f:
                json.dump(session.bookmarks, f)
            return True
        except Exception:
            return False

    def load_bookmarks(self, file_id: str) -> Dict[int, str]:
        """Load bookmarks from .loglayer/bookmarks/"""
        session = self._sessions.get(file_id)
        if not session or not session.path:
            return {}

        bookmark_file = self.get_bookmark_file_path(session.path)
        if not bookmark_file or not bookmark_file.exists():
            return {}

        try:
            with open(bookmark_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {int(k): v for k, v in data.items()}
        except Exception:
            return {}

    def update_session_stats(
        self,
        file_id: str,
        line_count: int,
        is_sparse: bool = False,
        sparse_interval: int = 1,
        partial: bool = False,
    ):
        """
        Update session after indexing completes.

        Args:
            file_id: Session ID
            line_count: Total line count
            is_sparse: Whether sparse indexing was used
            sparse_interval: Sparse indexing interval
            partial: Whether this is a partial (preview) result
        """
        session = self._sessions.get(file_id)
        if not session:
            return

        # Clear caches
        session.processing_cache.clear()
        if session.rendering_cache:
            session.rendering_cache.clear()

        session.sparse_index = is_sparse
        session.sparse_interval = sparse_interval
        session.sparse_line_count = line_count
        session.sparse_cache.clear()
        session.visible_indices = None

    def get_session_file_path(self, file_id: str) -> Optional[str]:
        """Get the file path for a session."""
        session = self._sessions.get(file_id)
        return session.path if session else None

    @property
    def sessions(self) -> Dict[str, LogSession]:
        """Get all sessions (for backward compatibility)."""
        return self._sessions


# Backward compatibility: expose LRUCache at module level
__all__ = ["LogSession", "SessionManager", "LRUCache"]
