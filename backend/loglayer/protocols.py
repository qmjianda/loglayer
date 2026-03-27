"""
Protocol definitions for session objects - formal interfaces for type safety.
"""

from typing import Protocol, Optional, Any, Dict, List
import array


class SessionProtocol(Protocol):
    """Protocol defining the expected interface for session objects."""

    id: str
    path: str
    provider: Any
    file_obj: Any
    mmap: Any
    size: int
    line_offsets: array.array
    visible_indices: Any
    search_matches: Any
    layers: List[Dict]
    layer_instances: List[Any]
    rendering_instances: List[Any]
    search_config: Optional[Dict[str, Any]]
    sparse_index: bool
    sparse_interval: int
    sparse_cache: Dict[int, int]
    processing_cache: Dict[str, Any]
    rendering_cache: Any
    workers: Dict[str, Any]
    stats_cache: Dict[str, Any]
    stats_config_hash: str
    bookmarks: Dict[int, str]

    def close(self, bridge: Any = None) -> None:
        """Close the session and cleanup resources."""
        ...


class LayerInstanceProtocol(Protocol):
    """Protocol for layer instance objects."""

    id: str
    type: str
    config: Dict[str, Any]
    enabled: bool

    def process_line(self, content: str) -> Any:
        """Process a line of content."""
        ...

    def filter_line(self, content: str, index: int = 0) -> bool:
        """Filter a line by index."""
        ...


class WorkerProtocol(Protocol):
    """Protocol for worker thread objects."""

    def isRunning(self) -> bool:
        """Check if worker is running."""
        ...

    def start(self) -> None:
        """Start the worker."""
        ...

    def stop(self) -> None:
        """Stop the worker."""
        ...


class StorageProviderProtocol(Protocol):
    """Protocol for storage provider objects."""

    def open(self, uri: str) -> Any:
        """Open a file and return file-like object."""
        ...

    def get_size(self, uri: str) -> int:
        """Get file size."""
        ...

    def get_name(self, uri: str) -> str:
        """Get file name."""
        ...


__all__ = [
    "SessionProtocol",
    "LayerInstanceProtocol",
    "WorkerProtocol",
    "StorageProviderProtocol",
]
