"""bridge 包：从原 bridge.py 拆分（refactor-bridge-module）。

对外保持向后兼容：`from bridge import FileBridge, LogSession, ...` 与
`from backend.bridge import ...` 两种导入路径均可工作。
"""

from .utils import (
    TIMING_ENABLED,
    timing,
    timing_start,
    convert_windows_path_to_linux,
    resolve_file_path,
    get_creationflags,
    get_log_files_recursive,
    get_directory_contents,
)
from .cache import LRUCache
from .signal import Signal
from .search_matching import compute_search_matches
from .workers import (
    CustomThread,
    IndexingWorker,
    PipelineWorker,
    StatsWorker,
    PROCESS_CLEANUP_TIMEOUT,
)
from .session import LogSession
from .file_bridge import FileBridge

__all__ = [
    "TIMING_ENABLED",
    "timing",
    "timing_start",
    "convert_windows_path_to_linux",
    "resolve_file_path",
    "get_creationflags",
    "get_log_files_recursive",
    "get_directory_contents",
    "LRUCache",
    "Signal",
    "compute_search_matches",
    "CustomThread",
    "IndexingWorker",
    "PipelineWorker",
    "StatsWorker",
    "PROCESS_CLEANUP_TIMEOUT",
    "LogSession",
    "FileBridge",
]
