import os
import sys
import mmap
import json
import time
import re
import array
import threading
import logging
import platform
from pathlib import Path
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor
from loglayer.registry import LayerRegistry
from loglayer.core import LayerStage, ProcessedLine
from loglayer.schemas import FileLoadedPayload, WorkerConfig
from workers import (
    IndexingWorker,
    PipelineWorker,
    StatsWorker
)
from search_mixin import SearchPipeline, BookmarkPipeline
from pipeline_mixin import LayerPipelineMixin

try:
    import tkinter as tk
    from tkinter import filedialog
except ImportError:
    tk = None
    filedialog = None

# Setup logger
logger = logging.getLogger(__name__)


def convert_windows_path_to_linux(windows_path: str) -> str:
    """将 Windows 路径转换为 Linux 路径"""
    if platform.system() != "Windows":
        # 处理 Windows 盘符 (如 D:\Project\... -> /mnt/d/Project/...)
        path = windows_path.replace("\\", "/")

        # 检查是否是 Windows 盘符路径
        match = re.match(r"^([A-Za-z]):/(.*)", path)
        if match:
            drive_letter = match.group(1).lower()
            rest_path = match.group(2)
            # 动态映射任意盘符: X: -> /mnt/x
            return f"/mnt/{drive_letter}/{rest_path}"

        # 如果不是 Windows 盘符，可能是 WSL 路径或网络路径
        # 尝试直接返回转换后的路径
        return path
    return windows_path


def resolve_file_path(file_path: str) -> str:
    """解析文件路径，处理跨平台路径问题"""
    # 使用 Path 来规范化路径（处理正反斜杠）
    normalized_path = Path(file_path)

    # 首先检查原路径是否存在（Path会自动处理路径格式）
    if normalized_path.exists():
        return str(normalized_path)

    # 在非 Windows 平台上，尝试转换为 Linux 路径
    if platform.system() != "Windows":
        linux_path = convert_windows_path_to_linux(file_path)
        if Path(linux_path).exists():
            return linux_path

    # 返回规范化后的原始路径
    return str(normalized_path)


class LRUCache:
    """Simple LRU Cache implementation"""
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self._cache = {}
        self._access_order = []
    
    def __setitem__(self, key, value):
        if key in self._cache:
            self._access_order.remove(key)
        elif len(self._cache) >= self.max_size:
            lru_key = self._access_order.pop(0)
            del self._cache[lru_key]
        self._cache[key] = value
        self._access_order.append(key)
    
    def __getitem__(self, key):
        if key in self._cache:
            self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]
        raise KeyError(key)
    
    def __contains__(self, key):
        return key in self._cache
    
    def __len__(self):
        return len(self._cache)
    
    def get(self, key, default=None):
        if key in self._cache:
            self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]
        return default
    
    def put(self, key, value):
        self[key] = value
    
    def clear(self):
        self._cache.clear()
        self._access_order.clear()

# Constants
PROCESS_CLEANUP_TIMEOUT = 0.3  # Seconds to wait for process termination before killing


def get_creationflags():
    """Returns subprocess creation flags to hide windows on Windows."""
    if platform.system() == "Windows":
        return 0x08000000  # CREATE_NO_WINDOW
    return 0


def get_log_files_recursive(folder_path):
    """Utility to find log files in a directory recursively."""
    log_files = []
    try:
        for root, _, files in os.walk(folder_path):
            for file in files:
                if (
                    file.lower().endswith((".log", ".txt", ".json", ".csv", ".md"))
                    or "." not in file
                ):
                    full_path = os.path.join(root, file)
                    try:
                        stats = os.stat(full_path)
                        log_files.append(
                            {"name": file, "path": full_path, "size": stats.st_size}
                        )
                    except (OSError, PermissionError):
                        continue
    except Exception as e:
            logger.error(f"Error walking directory {folder_path}: {e}")
    return log_files


def get_directory_contents(folder_path):
    """Utility to list all files and folders in a directory (one level)."""
    items = []
    try:
        path = Path(folder_path)
        for entry in path.iterdir():
            try:
                is_dir = entry.is_dir()
                items.append(
                    {
                        "name": entry.name,
                        "path": str(entry.absolute()),
                        "isDir": is_dir,
                        "size": entry.stat().st_size if not is_dir else 0,
                    }
                )
            except (OSError, PermissionError):
                continue
        items.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    except Exception as e:
            logger.error(f"Error listing directory {folder_path}: {e}")
    return items


from workers import Signal, IndexingWorker, PipelineWorker, StatsWorker


# ============================================================
# Cache Invalidation Strategy
# ============================================================
#
# The session cache stores processed line data for fast retrieval.
#
# Strategy:
# 1. TTL (Time-To-Live): Entries expire after 5 minutes (300 seconds)
#    - Prevents stale data from being served after layer config changes
#    - Balance: 5min is long enough for user navigation, short enough for freshness
#
# 2. LRU (Least Recently Used): Max 5000 entries
#    - Evicts oldest entries when capacity reached
#    - Prevents unbounded memory growth for large files
#
# 3. Invalidation Triggers (existing behavior preserved):
#    - _on_indexing_finished (line ~521): File re-indexed, all cache invalid
#    - sync_layers (line ~538): Layer config changed, all cache invalid
#    - sync_decorations (line ~574): Visual-only changes, cache cleared for consistency
#    - _on_pipeline_finished (line ~647): Pipeline output changed, all cache invalid
#
# Implementation note: Use OrderedDict for O(1) LRU operations
# ============================================================


import threading

class LogSession:
    def __init__(self, file_id, path, provider=None):
        self.id = file_id
        self.path = str(path)
        self.provider = provider
        self.file_obj = None
        self.mmap = None
        self._mmap_lock = threading.RLock()  # 线程安全锁
        self.size = 0
        self.line_offsets = array.array("Q")
        self.visible_indices = None
        self.search_matches = None
        self.layers = []
        self.layer_instances = []
        self.rendering_instances = []
        self.search_config = None
        self.sparse_index = False
        self.sparse_interval = 1
        self.sparse_cache = {}
        self.processing_cache = {}
        self.rendering_cache = LRUCache(max_size=5000)
        self.workers = {}
        
        # 独立于图层系统的书签存储 (line_index -> comment)
        self.bookmarks = {}

    @property
    def cache(self):
        """Backward compatibility - combined view of both caches."""
        return {**self.processing_cache, **self.rendering_cache._cache}

    def close(self, bridge=None):
        # 先停止所有worker
        for name, worker in list(self.workers.items()):
            if bridge:
                bridge._retire_worker(worker)
            else:
                if worker.isRunning():
                    worker.stop()
                    worker.wait()
        self.workers.clear()
        
        # 使用锁保护mmap关闭
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


class FileBridge(SearchPipeline, BookmarkPipeline, LayerPipelineMixin):
    fileLoaded = Signal(str, str)
    pipelineFinished = Signal(str, int, int)
    statsFinished = Signal(str, str)
    operationStarted = Signal(str, str)
    operationProgress = Signal(str, str, float)
    operationError = Signal(str, str, str)
    operationStatusChanged = Signal(str, str, int)
    pendingFilesCount = Signal(int)
    frontendReady = Signal()
    workspaceOpened = Signal(str)

    def __init__(self):
        super().__init__()
        self._sessions = {}
        self._rg_path = self._get_rg_path()
        # Dynamic worker pool sizing
        self._executor_max_workers = 4
        self.executor = ThreadPoolExecutor(max_workers=self._executor_max_workers)
        self._zombie_workers = []
        self._zombie_cleanup_counter = 0  # 清理计数器
        plugin_dir = os.path.join(os.getcwd(), "backend", "plugins")
        self._registry = LayerRegistry(plugin_dir)
        self._registry.discover_plugins()

    def get_worker_config(self) -> str:
        """Returns current worker pool configuration."""
        config = WorkerConfig(
            max_workers=self._executor_max_workers,
            cpu_count=os.cpu_count() or 4,
        )
        return config.model_dump_json()

    def set_worker_count(self, max_workers: int) -> bool:
        """Dynamically adjust ThreadPoolExecutor size.

        Args:
            max_workers: Number of worker threads (1-32)

        Returns:
            True if successful, False otherwise
        """
        try:
            max_workers = max(1, min(32, int(max_workers)))
            if max_workers == self._executor_max_workers:
                return True

            # Create new executor with updated size
            old_executor = self.executor
            self._executor_max_workers = max_workers
            self.executor = ThreadPoolExecutor(max_workers=max_workers)

            # Shutdown old executor gracefully (don't wait, allow pending tasks to complete)
            old_executor.shutdown(wait=False)

            logger.info(f"[WorkerPool] Adjusted to {max_workers} workers")
            return True
        except Exception as e:
            logger.warning(f"[WorkerPool] Failed to adjust worker count: {e}")
            return False

    def get_platform_info(self) -> str:
        return platform.system()

    def _retire_worker(self, worker):
        if not worker:
            return
        try:
            worker.finished.disconnect()
            worker.error.disconnect()
            if hasattr(worker, "progress"):
                worker.progress.disconnect()
        except (RuntimeError, TypeError):
            pass
        worker.stop()
        self._zombie_workers.append(worker)
        worker.finished.connect(lambda *args: self._cleanup_zombie(worker))
        worker.error.connect(lambda *args: self._cleanup_zombie(worker))
        if not worker.isRunning():
            self._cleanup_zombie(worker)

    def _cleanup_zombie(self, worker):
        """清理已完成的 zombie worker"""
        if worker in self._zombie_workers:
            self._zombie_workers.remove(worker)
        # 定期清理：每 5 次调用后检查并清理过期的 zombie workers
        self._zombie_cleanup_counter += 1
        if self._zombie_cleanup_counter >= 5:
            self._zombie_cleanup_counter = 0
            # 强制等待已停止的 workers 清理资源
            for w in list(self._zombie_workers):
                if not w.isRunning():
                    w.wait(timeout=0.5)
                    self._zombie_workers.remove(w)

    def _get_rg_path(self):
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            base_dir = sys._MEIPASS
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        bundled_bin = os.path.join(
            base_dir, "bin", "windows" if platform.system() == "Windows" else "linux"
        )
        dev_bin = os.path.join(
            os.path.dirname(base_dir),
            "bin",
            "windows" if platform.system() == "Windows" else "linux",
        )
        path_to_check = bundled_bin if os.path.exists(bundled_bin) else dev_bin
        exe = "rg.exe" if platform.system() == "Windows" else "rg"
        return os.path.join(path_to_check, exe)

    def open_file(self, file_id: str, file_path: str) -> bool:
        try:
            if file_id in self._sessions:
                self._sessions[file_id].close(self)

            # 解析文件路径（处理 Windows -> Linux 路径转换）
            resolved_path = resolve_file_path(file_path)

            provider = self._registry.storage.get_provider(resolved_path)
            session = LogSession(file_id, resolved_path, provider)

            session.size = provider.get_size(resolved_path)
            session.file_obj = provider.open(resolved_path)
            if session.size == 0:
                session.line_offsets = array.array("Q")
                self._sessions[file_id] = session
                payload = FileLoadedPayload(
                    name=provider.get_name(resolved_path),
                    size=0,
                    lineCount=0,
                )
                self.fileLoaded.emit(file_id, payload.model_dump_json())
                return True

            session.mmap = provider.get_mmap(resolved_path)
            self._sessions[file_id] = session
            self.operationStarted.emit(file_id, "indexing")

            # TODO: Handle non-mmap workers for remote providers
            worker = IndexingWorker(
                session.mmap or session.file_obj, session.size, resolved_path
            )
            session.workers["indexing"] = worker
            worker.finished.connect(
                lambda offsets: self._on_indexing_finished(file_id, offsets)
            )
            worker.progress.connect(
                lambda p: self.operationProgress.emit(file_id, "indexing", p)
            )
            worker.error.connect(
                lambda e: self.operationError.emit(file_id, "indexing", e)
            )
            worker.start()
            return True
        except Exception as e:
            logger.error(f"Error opening file: {e}")
            return False

    def _on_indexing_finished(self, file_id, result):
        if isinstance(result, dict):
            offsets = result.get("offsets", result)
            is_partial = result.get("partial", False)
            line_count = (
                result.get("lineCount")
                or result.get("line_count")
                or result.get("total")
                or len(offsets)
            )
            is_sparse = result.get("sparse", False)
            sparse_interval = result.get("sparseInterval", 1)
        else:
            offsets = result
            is_partial = False
            line_count = len(offsets)
            is_sparse = False
            sparse_interval = 1

        if file_id not in self._sessions:
            return
        session = self._sessions[file_id]

        if offsets:
            session.line_offsets = offsets
        session.visible_indices = None
        session.processing_cache.clear()
        session.rendering_cache.clear()
        session.sparse_index = is_sparse
        session.sparse_interval = sparse_interval
        session.sparse_line_count = line_count
        session.sparse_cache.clear()

        name = (
            session.provider.get_name(session.path)
            if session.provider
            else Path(session.path).name
        )

        payload = FileLoadedPayload(
            name=name,
            size=session.size,
            lineCount=line_count,
            partial=is_partial,
            sparse=is_sparse,
        )
        self.fileLoaded.emit(
            file_id,
            payload.model_dump_json(),
        )

    def get_layer_registry(self) -> str:
        return json.dumps(self._registry.get_all_types())

    def reload_plugins(self) -> bool:
        self._registry.discover_plugins()
        return True

    # Search methods have been moved to SearchMixin

    def _get_line_offset_sparse(self, session, line_idx):
        if not session.sparse_index:
            return session.line_offsets[line_idx] if line_idx < len(session.line_offsets) else session.size

        if line_idx in session.sparse_cache:
            return session.sparse_cache[line_idx]

        interval = session.sparse_interval
        sparse_offsets = session.line_offsets

        if line_idx >= len(sparse_offsets) * interval:
            return session.size

        block_idx = line_idx // interval
        start_search = sparse_offsets[block_idx] if block_idx < len(sparse_offsets) else 0

        if block_idx + 1 < len(sparse_offsets):
            end_search = sparse_offsets[block_idx + 1]
        else:
            end_search = session.size

        target_line = line_idx % interval
        current_line = 0
        found_offset = start_search

        mmap_obj = session.mmap
        search_start = start_search
        while search_start < end_search:
            newline_pos = mmap_obj.find(b"\n", search_start, end_search)
            if newline_pos == -1:
                break
            if current_line == target_line:
                session.sparse_cache[line_idx] = found_offset
                return found_offset
            found_offset = newline_pos + 1
            current_line += 1
            search_start = newline_pos + 1

        session.sparse_cache[line_idx] = found_offset
        return found_offset

    def read_processed_lines(self, file_id: str, start_line: int, count: int) -> str:
        if file_id not in self._sessions:
            return "[]"
        session = self._sessions[file_id]
        try:
            if session.mmap is None or session.mmap.closed:
                return "[]"
            _ = len(session.mmap)
            if start_line < 0:
                return "[]"
            results = []
            v_indices = session.visible_indices
            offsets = session.line_offsets
            is_sparse = session.sparse_index

            if is_sparse:
                total = getattr(session, 'sparse_line_count', len(offsets) * session.sparse_interval)
            else:
                total = len(v_indices) if v_indices is not None else len(offsets)

            end_idx = min(start_line + count, total)
            for i in range(start_line, end_idx):
                if i in session.rendering_cache:
                    results.append(session.rendering_cache[i])
                    continue
                try:
                    real_idx = v_indices[i] if v_indices is not None else i
                    if is_sparse:
                        start_off = self._get_line_offset_sparse(session, real_idx)
                        end_off = self._get_line_offset_sparse(session, real_idx + 1)
                    else:
                        if real_idx >= len(offsets):
                            continue
                        start_off = offsets[real_idx]
                        end_off = (
                            offsets[real_idx + 1]
                            if real_idx + 1 < len(offsets)
                            else session.size
                        )
                    chunk = session.mmap[start_off:end_off]
                    if len(chunk) > 10000:
                        chunk = chunk[:10000] + b"... [truncated]"
                    content = (
                        chunk.decode("utf-8", errors="replace")
                        .replace("\r", "")
                        .replace("\n", " ")
                    )

                    # 1. 应用处理层的内容变换
                    highlights = []
                    row_style: Dict[str, Any] = {}
                    # 只有 Transform 类型的图层允许修改内容
                    logic_layers = [
                        l
                        for l in session.layer_instances
                        if l.stage == LayerStage.LOGIC
                    ]
                    current_offset_map = None

                    for layer in logic_layers:
                        # Only call process_line if the layer has this method (TransformLayer, etc.)
                        if hasattr(layer, 'process_line'):
                            res = layer.process_line(content)
                            if isinstance(res, ProcessedLine):
                                content = res.content
                                # 这里可以累加 offset_map，如果多个转换层叠加
                                if res.offset_map:
                                    current_offset_map = res.offset_map
                            else:
                                content = res

                    # 2. 应用渲染层的高亮和行样式
                    # 此时渲染层面对的是已经过滤且转换后的 content
                    rendering_layers = getattr(session, "rendering_instances", [])
                    for layer in reversed(rendering_layers):
                        # 获取高亮 (如 HighlightLayer)
                        if hasattr(layer, "highlight_line"):
                            hls = layer.highlight_line(content)
                            if hls:
                                # 如果未来需要将高亮映射回原始行，可以使用 current_offset_map
                                highlights.extend(hls)

                        # 获取行样式 (如 RowTintLayer)
                        if hasattr(layer, "get_row_style"):
                            style = (
                                layer.get_row_style(content, index=real_idx)
                                if "index" in layer.get_row_style.__code__.co_varnames
                                else layer.get_row_style(content)
                            )
                            if style:
                                # RowStyle dataclass -> dict
                                if hasattr(style, '__dataclass_fields__'):
                                    for field in style.__dataclass_fields__:
                                        val = getattr(style, field)
                                        if val is not None:
                                            row_style[field] = val
                                else:
                                    row_style.update(style)

                    # 3. 应用搜索高亮
                    if session.search_config and session.search_config.get("query"):
                        sc = session.search_config
                        try:
                            flags = re.IGNORECASE if not sc.get("caseSensitive") else 0
                            pattern = (
                                sc["query"]
                                if sc.get("regex")
                                else re.escape(sc["query"])
                            )
                            search_re = re.compile(pattern, flags)
                            for m in search_re.finditer(content):
                                highlights.append(
                                    {
                                        "start": m.start(),
                                        "end": m.end(),
                                        "color": "#facc15",
                                        "opacity": 100,
                                        "isSearch": True,
                                    }
                                )
                        except (re.error, AttributeError):
                            pass
                    
                    # 4. 直接读取 session.bookmarks (独立于图层系统)
                    line_data = {
                        "index": real_idx,
                        "content": content,
                        "highlights": highlights,
                    }
                    if real_idx in session.bookmarks:
                        line_data["isMarked"] = True
                        comment = session.bookmarks.get(real_idx)
                        if comment:
                            line_data["bookmarkComment"] = comment
                        # 添加书签视觉标记
                        if not row_style:
                            row_style = {}
                        row_style["borderLeft"] = "3px solid #f59e0b"

                    if row_style:
                        line_data["rowStyle"] = row_style
                    # LRU Cache 会自动处理容量限制
                    session.rendering_cache[i] = line_data
                    results.append(line_data)
                except (IndexError, ValueError):
                    continue
            return json.dumps(results)
        except (ValueError, RuntimeError) as e:
            logger.error(f"Session error for {file_id}: {e}")
            return "[]"

    def list_directory(self, folder_path: str) -> str:
        return json.dumps(get_directory_contents(folder_path))

    def save_workspace_config(self, folder_path: str, config_json: str) -> bool:
        try:
            config_dir = Path(folder_path) / ".loglayer"
            config_dir.mkdir(parents=True, exist_ok=True)
            config_file = config_dir / "config.json"
            with open(config_file, "w", encoding="utf-8") as f:
                f.write(config_json)
            return True
        except Exception as e:
            logger.error(f"[Workspace] Error saving config: {e}")
            return False

    def load_workspace_config(self, folder_path: str) -> str:
        try:
            config_file = Path(folder_path) / ".loglayer" / "config.json"
            if not config_file.exists():
                return ""
            with open(config_file, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            logger.error(f"[Workspace] Error loading config: {e}")
            return ""

    def get_lines_by_indices(self, file_id: str, indices: list) -> str:
        """获取指定索引的行内容（纯文本）"""
        if file_id not in self._sessions:
            return "[]"
        session = self._sessions[file_id]
        try:
            if session.mmap is None:
                return "[]"
            results = []
            offsets = session.line_offsets

            for idx in indices[:100]:  # 限制最多100行
                try:
                    if idx < 0 or idx >= len(offsets):
                        continue
                    start_off = offsets[idx]
                    end_off = (
                        offsets[idx + 1] if idx + 1 < len(offsets) else session.size
                    )
                    chunk = session.mmap[start_off:end_off]
                    if len(chunk) > 200:
                        chunk = chunk[:200]  # 截断为200字符
                    content = (
                        chunk.decode("utf-8", errors="replace")
                        .replace("\r", "")
                        .replace("\n", "")
                        .strip()
                    )
                    results.append({"index": idx, "text": content})
                except (IndexError, ValueError):
                    continue
            return json.dumps(results)
        except (ValueError, RuntimeError) as e:
            logger.error(f"get_lines_by_indices error for {file_id}: {e}")
            return "[]"

    def ready(self):
        self.frontendReady.emit()

    def search_ripgrep(
        self,
        file_id: str,
        query: str,
        regex: bool = False,
        case_sensitive: bool = False,
    ) -> bool:
        if file_id not in self._sessions:
            return False
        session = self._sessions[file_id]
        if not query:
            session.search_config = None
        else:
            session.search_config = {
                "query": query,
                "regex": regex,
                "caseSensitive": case_sensitive,
            }
        self._start_pipeline(file_id, session.layer_instances)
        return True

    def close_file(self, file_id: str):
        if file_id in self._sessions:
            session = self._sessions[file_id]
            session.close(self)
            del self._sessions[file_id]

    def select_files(self) -> str:
        if hasattr(self, "window"):
            try:
                from webview import FileDialog

                paths = self.window.create_file_dialog(
                    FileDialog.OPEN,
                    allow_multiple=True,
                    file_types=("Log files (*.log;*.txt;*.json)", "All files (*.*)"),
                )
            except Exception as e:
                logger.error(f"[Bridge] select_files error: {e}")
                paths = self.window.create_file_dialog(
                    0,
                    allow_multiple=True,
                    file_types=("Log files (*.log;*.txt;*.json)", "All files (*.*)"),
                )
            return json.dumps(paths if paths else [])

        # Fallback to tkinter for browser-only mode
        if tk and filedialog:
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            paths = filedialog.askopenfilenames(
                title="选择日志文件",
                filetypes=[("Log files", "*.log *.txt *.json"), ("All files", "*.*")],
            )
            root.destroy()
            return json.dumps(list(paths) if paths else [])

        return "[]"

    def select_folder(self) -> str:
        if hasattr(self, "window"):
            try:
                from webview import FileDialog

                path = self.window.create_file_dialog(FileDialog.FOLDER)
            except Exception as e:
                logger.error(f"[Bridge] select_folder error: {e}")
                path = self.window.create_file_dialog(1)  # 1 is FOLDER
            return path[0] if path else ""

        # Fallback to tkinter for browser-only mode
        if tk and filedialog:
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            path = filedialog.askdirectory(title="选择项目文件夹")
            root.destroy()
            return path if path else ""

        return ""

    def list_logs_in_folder(self, folder_path: str) -> str:
        return json.dumps(get_log_files_recursive(folder_path))

    def get_log_level_stats(self, file_id: str) -> dict:
        """获取日志级别统计信息"""
        if file_id not in self._sessions:
            return {"error": "File not found"}

        session = self._sessions[file_id]
        from loglayer.pattern_detector import get_detector

        detector = get_detector()
        level_counts = {
            "ERROR": 0,
            "WARN": 0,
            "INFO": 0,
            "DEBUG": 0,
            "TRACE": 0,
            "FATAL": 0,
        }

        # Sample lines for level detection (first 1000 lines for performance)
        sample_size = min(1000, len(session.line_offsets))
        for i in range(sample_size):
            try:
                start_off = session.line_offsets[i]
                end_off = (
                    session.line_offsets[i + 1]
                    if i + 1 < len(session.line_offsets)
                    else session.size
                )
                line = (
                    session.mmap[start_off:end_off]
                    .decode("utf-8", errors="replace")
                    .strip()
                )
                level = detector.detect_log_level(line)
                if level:
                    level_counts[level] = level_counts.get(level, 0) + 1
            except (IndexError, ValueError, UnicodeDecodeError):
                continue

        return {
            "levels": level_counts,
            "total": sample_size,
            "sampled": sample_size,
        }

    def analyze_log_pattern(self, file_id: str, sample_size: int = 100) -> dict:
        """分析日志文件的模式"""
        if file_id not in self._sessions:
            return {"error": "File not found"}

        session = self._sessions[file_id]
        from loglayer.pattern_detector import get_detector

        detector = get_detector()

        # Sample lines for analysis
        lines = []
        sample_count = min(sample_size, len(session.line_offsets))
        for i in range(sample_count):
            try:
                start_off = session.line_offsets[i]
                end_off = (
                    session.line_offsets[i + 1]
                    if i + 1 < len(session.line_offsets)
                    else session.size
                )
                line = (
                    session.mmap[start_off:end_off]
                    .decode("utf-8", errors="replace")
                    .strip()
                )
                lines.append(line)
            except (IndexError, ValueError, UnicodeDecodeError):
                continue

        analysis = detector.analyze_sample(lines)

        # Convert datetime objects to ISO format for JSON serialization
        return {
            "sample_size": analysis["sample_size"],
            "timestamp_formats": analysis["timestamp_formats"],
            "dominant_timestamp_format": analysis["dominant_timestamp_format"],
            "log_levels": analysis["log_levels"],
            "log_formats": analysis["log_formats"],
            "dominant_log_format": analysis["dominant_log_format"],
            "has_structured_logs": analysis["has_structured_logs"],
            "has_stacktraces": analysis["has_stacktraces"],
        }

    def suggest_layers(self, file_id: str) -> dict:
        """基于日志分析结果推荐图层配置"""
        if file_id not in self._sessions:
            return {"error": "File not found"}

        session = self._sessions[file_id]
        from loglayer.pattern_detector import get_detector

        detector = get_detector()

        # Sample lines for analysis
        lines = []
        sample_count = min(100, len(session.line_offsets))
        for i in range(sample_count):
            try:
                start_off = session.line_offsets[i]
                end_off = (
                    session.line_offsets[i + 1]
                    if i + 1 < len(session.line_offsets)
                    else session.size
                )
                line = (
                    session.mmap[start_off:end_off]
                    .decode("utf-8", errors="replace")
                    .strip()
                )
                lines.append(line)
            except (IndexError, ValueError, UnicodeDecodeError):
                continue

        analysis = detector.analyze_sample(lines)
        suggestions = detector.suggest_layer_config(analysis)

        return suggestions

    def export_visible_lines(self, file_id: str, output_path: str, format: str = 'txt') -> dict:
        """
        Export visible (filtered) log lines to a file.
        
        Args:
            file_id: File session ID
            output_path: Output file path
            format: Export format (csv/json/txt)
            
        Returns:
            Dict with success status and message
        """
        if file_id not in self._sessions:
            return {'success': False, 'error': 'File not found'}
        
        from loglayer.export import LogExporter
        
        session = self._sessions[file_id]
        exporter = LogExporter(file_id, session.path)
        
        success = exporter.export_visible_lines(
            self, 
            output_path, 
            format, 
            include_line_numbers=True
        )
        
        if success:
            return {'success': True, 'path': output_path}
        else:
            return {'success': False, 'error': 'Export failed'}

    # SearchMixin provides:
    # get_search_match_index, get_nearest_search_rank, get_search_matches_range,
    # toggle_bookmark, get_bookmarks, get_nearest_bookmark_index, clear_bookmarks,
    # physical_to_visual_index, update_bookmark_comment
