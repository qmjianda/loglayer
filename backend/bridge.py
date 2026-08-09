import os
import sys
import mmap
import array
import json
import re
import subprocess
import threading
import time
import webview
import platform
from pathlib import Path
import importlib
from concurrent.futures import ThreadPoolExecutor
from typing import Optional


# ==== 性能打点（性能看护，默认关闭；LOGLAYER_TIMING=1 开启）====
# 统一格式: [Timing] <stage> wall=<epoch_ms> file=<file_id> <duration_ms>ms <extra>
# wall 与前端 Date.now() 同毫秒时间轴，可跨前后端对齐时间线。
TIMING_ENABLED = os.environ.get("LOGLAYER_TIMING") == "1"


def timing_start() -> Optional[float]:
    return time.perf_counter() if TIMING_ENABLED else None


def timing(stage: str, file_id: str = "", t0: Optional[float] = None, extra: str = "") -> None:
    if not TIMING_ENABLED:
        return
    wall = int(time.time() * 1000)
    parts = [f"[Timing] {stage}", f"wall={wall}"]
    if file_id:
        parts.append(f"file={file_id}")
    if t0 is not None:
        parts.append(f"{(time.perf_counter() - t0) * 1000:.1f}ms")
    if extra:
        parts.append(extra)
    print(" ".join(parts))


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


try:
    import tkinter as tk
    from tkinter import filedialog
except ImportError:
    tk = None
    filedialog = None

from loglayer.registry import LayerRegistry
from loglayer.core import LayerStage, LayerCategory, ProcessedLine
from loglayer.vfs import LocalFileProvider
from loglayer.metadata_cache import SqliteMetadataCache, CachedFileIndex
from loglayer.workspace_store import WorkspaceStore
from loglayer.cache_keys import compute_layers_hash, compute_query_hash
from loglayer.cache_store import CacheStore
from search_mixin import SearchPipeline, BookmarkPipeline
from cachetools import LRUCache as _CachetoolsLRU

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
        print(f"Error walking directory {folder_path}: {e}")
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
            except:
                continue
        items.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    except Exception as e:
        print(f"Error listing directory {folder_path}: {e}")
    return items


class Signal:
    """A simple replacement for pyqtSignal with thread safety."""

    def __init__(self, *types):
        self._callbacks = []
        self._lock = threading.Lock()

    def connect(self, callback):
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)

    def disconnect(self, callback=None):
        with self._lock:
            if callback is None:
                self._callbacks = []
            elif callback in self._callbacks:
                self._callbacks.remove(callback)

    def emit(self, *args):
        with self._lock:
            callbacks = list(self._callbacks)
        for callback in callbacks:
            try:
                callback(*args)
            except Exception as e:
                print(f"Error in signal callback: {e}")


class CustomThread:
    """A replacement for QThread using threading.Thread."""

    def __init__(self):
        self._thread = None
        self._is_running = False
        self._cancel_event = threading.Event()

    def start(self):
        self._is_running = True
        self._cancel_event.clear()
        self._thread = threading.Thread(target=self.run, daemon=True)
        self._thread.start()

    def isRunning(self):
        return self._thread and self._thread.is_alive()

    def stop(self):
        self._is_running = False
        self._cancel_event.set()

    def wait(self, timeout=None):
        if self._thread:
            self._thread.join(timeout=timeout)

    def cancel(self):
        """Request cancellation of the worker."""
        self._cancel_event.set()

    def is_cancelled(self):
        """Check if cancellation was requested."""
        return self._cancel_event.is_set()

    def run(self):
        raise NotImplementedError()


class IndexingWorker(CustomThread):
    """单阶段完整索引：扫描全部行偏移后一次性 emit finished。

    已移除 preview/partial 两阶段：首次打开完整等待，命中缓存秒开。
    """

    def __init__(self, mmap_obj, size, file_path=None):
        super().__init__()
        self.finished = Signal(object)
        self.progress = Signal(float)
        self.error = Signal(str)
        self.mmap = mmap_obj
        self.size = size
        self.file_path = file_path
        self._is_running = True

    def run(self):
        try:
            start_time = time.time()
            offsets = array.array("Q", [0])
            scanned = 0

            last_offset = 0
            for m in re.finditer(b"\n", self.mmap):
                if self.is_cancelled():
                    return
                offsets.append(m.start() + 1)
                last_offset = m.end()
                scanned += 1

                if scanned % 1000000 == 0:
                    progress = min(100, (m.start() / max(1, self.size) * 100))
                    self.progress.emit(progress)

            # Cleanup tail
            if len(offsets) > 1 and offsets[-1] >= self.size:
                offsets.pop()

            total_time = time.time() - start_time
            speed_mbps = self.size / total_time / 1024 / 1024 if total_time > 0 else 0
            print(
                f"[Indexing] Complete: {len(offsets)} lines in {total_time:.2f}s ({speed_mbps:.1f} MB/s)"
            )
            self.finished.emit(
                {
                    "offsets": offsets,
                    "partial": False,
                    "lineCount": len(offsets),
                }
            )

        except Exception as e:
            self.error.emit(str(e))


def compute_search_matches(
    rg_path: str,
    file_path: str,
    search_config: Optional[dict],
    is_cancelled=None,
) -> "array.array":
    """独立计算搜索匹配的物理行号，与过滤管线完全解耦。

    返回有序的匹配物理行号数组（`array.array('I')`）。搜索词为空或
    配置缺失时返回空数组。`is_cancelled` 为可选可调用对象，用于支持
    管线取消（循环中检查，返回 True 时提前终止）。
    """
    if not search_config or not search_config.get("query"):
        return array.array("I")

    cmd = [
        rg_path,
        "--line-number",
        "--no-heading",
        "--no-filename",
        "--color",
        "never",
    ]
    if search_config.get("regex"):
        cmd.append("-e")
    else:
        cmd.append("-F")
    if not search_config.get("caseSensitive"):
        cmd.append("-i")
    if search_config.get("wholeWord"):
        cmd.append("-w")
    cmd.append(search_config["query"])
    cmd.append(file_path)

    matching_physicals = array.array("I")
    sp = None
    try:
        sp = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
            creationflags=get_creationflags(),
        )
        if sp.stdout:
            for match_line_bytes in sp.stdout:
                if is_cancelled and is_cancelled():
                    break
                match_line = match_line_bytes.decode("utf-8", errors="replace")
                parts = match_line.split(":", 1)
                if parts[0].isdigit():
                    # rg --line-number 输出天然按行号升序且每行至多一次，
                    # 直接 append 到 array('I')（4B/元素），避免 set() 的高内存开销
                    matching_physicals.append(int(parts[0]) - 1)
        if is_cancelled and is_cancelled():
            try:
                sp.terminate()
            except Exception:
                pass
        sp.wait(timeout=5)
    except Exception as e:
        print(f"[Search] compute_search_matches error: {e}")
    finally:
        # 取消/异常路径兜底：确保 rg 子进程被回收，不残留孤儿进程
        if sp is not None and sp.poll() is None:
            try:
                sp.terminate()
            except Exception:
                pass
            try:
                sp.wait(timeout=2)
            except Exception:
                try:
                    sp.kill()
                except Exception:
                    pass

    return matching_physicals


class PipelineWorker(CustomThread):
    def __init__(
        self,
        rg_path,
        file_path,
        layers,
        search_config=None,
        skip_filter=False,
        precomputed_visible=None,
        precomputed_matches=None,
    ):
        super().__init__()
        self.finished = Signal(object, object)
        self.progress = Signal(float)
        self.error = Signal(str)
        self.rg_path = rg_path
        self.file_path = file_path
        self.layers = layers
        self.search = search_config
        self.skip_filter = skip_filter  # True=仅计算搜索匹配，过滤结果复用缓存
        self.precomputed_visible = precomputed_visible  # skip_filter 时输出的可见行集
        self.precomputed_matches = precomputed_matches  # 搜索缓存命中时跳过 rg 计算
        self._is_running = True
        self._processes = []
        # 管线阶段计时（可观测，3.4）：filter_ms/search_ms 由 run() 填充
        self.timing = {"filter_ms": 0.0, "search_ms": 0.0, "total_ms": 0.0}

    def run(self):
        t_start = time.perf_counter()
        try:
            native_layers = [l for l in self.layers if l.stage == LayerStage.NATIVE]
            logic_layers = [l for l in self.layers if l.stage == LayerStage.LOGIC]

            # 1. 独立搜索匹配计算（物理行号，与过滤管线解耦）
            #    搜索缓存命中时直接复用，跳过 rg 扫描
            t_search0 = time.perf_counter()
            if self.precomputed_matches is not None:
                search_matches = self.precomputed_matches
            else:
                search_matches = compute_search_matches(
                    self.rg_path,
                    self.file_path,
                    self.search,
                    is_cancelled=self.is_cancelled,
                )
            self.timing["search_ms"] = round((time.perf_counter() - t_search0) * 1000, 1)

            # 1.5 过滤结果缓存命中：跳过过滤管线，直接输出缓存可见行集
            if self.skip_filter:
                self.timing["total_ms"] = round((time.perf_counter() - t_start) * 1000, 1)
                if self._is_running:
                    self.finished.emit(self.precomputed_visible, search_matches)
                return

            # 2. Quick Exit: If no filters at all, everything is visible
            if not native_layers and not logic_layers:
                visible_indices = None
                self.timing["total_ms"] = round((time.perf_counter() - t_start) * 1000, 1)
                if self._is_running:
                    self.finished.emit(visible_indices, search_matches)
                return

            # 3. Build Visibility Pipeline (NOT including global search)
            cmd_chain = []

            def build_rg_cmd(args, is_first, is_last_native):
                cmd = [
                    self.rg_path,
                    "--no-heading",
                    "--no-filename",
                    "--color",
                    "never",
                ]
                if is_first:
                    cmd.append("--line-number")

                cmd.extend(args)
                if is_first:
                    cmd.append(self.file_path)
                else:
                    cmd.append("-")
                return cmd

            for i, layer in enumerate(native_layers):
                rg_args = layer.get_rg_args()
                if not rg_args:
                    continue
                is_first = len(cmd_chain) == 0
                is_last_native = i == len(native_layers) - 1
                cmd_chain.append(build_rg_cmd(rg_args, is_first, is_last_native))

            if not cmd_chain:
                # Still need a process to feed the lines if we have logic layers but no native layers
                cmd_chain.append(build_rg_cmd([""], True, True))

            self._processes = []
            last_stdout = None
            for i, cmd in enumerate(cmd_chain):
                p = subprocess.Popen(
                    cmd,
                    stdin=last_stdout if i > 0 else None,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=1024 * 1024,
                    creationflags=get_creationflags(),
                )
                self._processes.append(p)
                if i > 0 and last_stdout:
                    last_stdout.close()
                last_stdout = p.stdout

            for l in logic_layers:
                l.reset()
            visible_indices = array.array("I")
            line_count = 0

            if last_stdout:
                for line_bytes in last_stdout:
                    if self.is_cancelled():
                        break
                    line_str = line_bytes.decode("utf-8", errors="ignore")
                    parts = line_str.split(":", 1)
                    if len(parts) < 2:
                        continue
                    try:
                        physical_idx = int(parts[0]) - 1
                        content = parts[1]
                    except ValueError:
                        continue

                    is_visible = True
                    if logic_layers:
                        for layer in logic_layers:
                            res = layer.process_line(content)
                            content = (
                                res.content if isinstance(res, ProcessedLine) else res
                            )
                            if not layer.filter_line(content, index=physical_idx):
                                is_visible = False
                                break

                    if is_visible:
                        visible_indices.append(physical_idx)

                    line_count += 1
                    if line_count % 10000 == 0:
                        self.progress.emit(0)

            self.timing["filter_ms"] = round(
                max(0, (time.perf_counter() - t_start - self.timing["search_ms"] / 1000) * 1000), 1
            )
            self.timing["total_ms"] = round((time.perf_counter() - t_start) * 1000, 1)
            if self._is_running:
                self.finished.emit(visible_indices, search_matches)

        except Exception as e:
            if self._is_running:
                self.error.emit(str(e))
        finally:
            self._cleanup_processes()

    def _cleanup_processes(self, timeout=PROCESS_CLEANUP_TIMEOUT):
        """安全清理所有子进程"""
        # 第一遍: 发送 terminate 信号
        for p in self._processes:
            try:
                if p.poll() is None:
                    p.terminate()
            except:
                pass
        # 第二遍: 等待进程退出，超时则强制 kill
        for p in self._processes:
            try:
                p.wait(timeout=timeout)
            except:
                try:
                    p.kill()  # 强制杀死僵尸进程
                except:
                    pass
        self._processes = []


class StatsWorker(CustomThread):
    def __init__(self, rg_path, layers, file_path, total_lines, search_config=None):
        super().__init__()
        self.finished = Signal(str)
        self.error = Signal(str)
        self.rg_path = rg_path
        self.layers = layers
        self.file_path = file_path
        self.total_lines = max(1, total_lines)
        self.search_config = search_config
        self._is_running = True
        self._processes = []

    def run(self):
        try:
            results = {}
            active_filters = []
            tasks = []
            for layer in self.layers:
                if self.is_cancelled():
                    break
                l_id = getattr(layer, "id", None)
                if not l_id:
                    continue
                q_conf = None
                if hasattr(layer, "query") and layer.query:
                    q_conf = {
                        "query": layer.query,
                        "regex": getattr(layer, "regex", False),
                        "caseSensitive": getattr(layer, "caseSensitive", False),
                    }
                if layer.__class__.__name__ == "LevelLayer":
                    lvls = getattr(layer, "levels", [])
                    if lvls:
                        q_conf = {
                            "query": f"\\b({'|'.join(map(re.escape, lvls))})\\b",
                            "regex": True,
                            "caseSensitive": True,
                        }
                current_filters = list(active_filters)
                if (
                    getattr(layer, "enabled", True)
                    and layer.__class__.__name__ in ["FilterLayer", "LevelLayer"]
                    and q_conf
                ):
                    active_filters.append(q_conf)
                if not q_conf:
                    continue
                tasks.append((layer, l_id, q_conf, current_filters))

            # Add searching stats as a virtual layer
            if self.search_config and self.search_config.get("query"):
                tasks.append((None, "search", self.search_config, []))

            with ThreadPoolExecutor(
                max_workers=min(8, os.cpu_count() or 4)
            ) as executor:
                future_to_lid = {}
                for layer, l_id, q_conf, filters in tasks:
                    future_to_lid[
                        executor.submit(self._run_layer_stats, l_id, q_conf, filters)
                    ] = l_id
                for future in future_to_lid:
                    if self.is_cancelled():
                        break
                    try:
                        lid, res = future.result()
                        if lid and res:
                            results[lid] = res
                    except Exception as e:
                        print(f"Stats task error: {e}")
            if self._is_running:
                self.finished.emit(json.dumps(results))
        except Exception as e:
            if self._is_running:
                self.error.emit(str(e))

    def _run_layer_stats(self, l_id, q_conf, parent_filters):
        if self.is_cancelled():
            return None, None
        cmd_chain = []
        for f in parent_filters:
            c = [self.rg_path, "--no-heading", "--no-filename", "--color", "never"]
            if not f.get("caseSensitive"):
                c.append("-i")
            if not f.get("regex"):
                c.append("-F")
            c.append(f["query"])
            cmd_chain.append(c)
        final_cmd = [
            self.rg_path,
            "--line-number",
            "--no-heading",
            "--no-filename",
            "--color",
            "never",
        ]
        if not q_conf.get("caseSensitive"):
            final_cmd.append("-i")
        if not q_conf.get("regex"):
            final_cmd.append("-F")
        final_cmd.append(q_conf["query"])
        count = 0
        distribution = [0] * 20
        procs = []
        try:
            if not cmd_chain:
                final_cmd.append(self.file_path)
                p_final = subprocess.Popen(
                    final_cmd,
                    stdout=subprocess.PIPE,
                    text=True,
                    errors="ignore",
                    creationflags=get_creationflags(),
                )
                procs.append(p_final)
            else:
                head_cmd = cmd_chain[0] + [self.file_path]
                p_head = subprocess.Popen(
                    head_cmd, stdout=subprocess.PIPE, creationflags=get_creationflags()
                )
                procs.append(p_head)
                curr_p = p_head
                for i in range(1, len(cmd_chain)):
                    p_next = subprocess.Popen(
                        cmd_chain[i],
                        stdin=curr_p.stdout,
                        stdout=subprocess.PIPE,
                        creationflags=get_creationflags(),
                    )
                    procs.append(p_next)
                    curr_p.stdout.close()
                    curr_p = p_next
                p_final = subprocess.Popen(
                    final_cmd,
                    stdin=curr_p.stdout,
                    stdout=subprocess.PIPE,
                    text=True,
                    errors="ignore",
                    creationflags=get_creationflags(),
                )
                procs.append(p_final)
                curr_p.stdout.close()
            for line in p_final.stdout:
                if self.is_cancelled():
                    break
                colon_pos = line.find(":")
                if colon_pos != -1:
                    l_str = line[:colon_pos]
                    if l_str.isdigit():
                        l_num = int(l_str) - 1
                        bucket = min(19, int((l_num / self.total_lines) * 20))
                        distribution[bucket] += 1
                        count += 1
            for p in procs:
                try:
                    p.terminate()
                    p.wait(timeout=0.1)
                except:
                    pass
        except Exception:
            pass
        max_val = max(distribution) if any(v > 0 for v in distribution) else 0
        norm_dist = [v / max_val if max_val > 0 else 0 for v in distribution]
        return l_id, {"count": count, "distribution": norm_dist}


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


class LogSession:
    def __init__(self, file_id, path, provider=None):
        self.id = file_id
        self.path = str(path)
        self.provider = provider
        self.file_obj = None  # type: ignore[assignment]
        self.mmap = None  # type: ignore[assignment]
        self.size = 0
        self.line_offsets = array.array("Q")
        self.visible_indices = None
        self.search_matches = None  # 匹配行的物理行号（有序 array），非视觉索引
        self.layers = []
        self.layer_instances = []  # 处理层实例
        self.rendering_instances = []  # 渲染层实例
        self.search_config = None
        self.layers_hash = None  # 当前图层配置的缓存 key（sync_layers 时计算）
        self.query_hash = None  # 当前搜索配置的缓存 key（搜索请求时计算）
        self._pipeline_from_cache = False  # 本次管线结果来自过滤缓存（写回时跳过）
        self._search_from_cache = False  # 本次搜索匹配来自搜索缓存（写回时跳过）
        # 分层缓存: processing_cache (过滤/转换结果) + rendering_cache (视觉效果)
        # 使用 LRU Cache 防止内存溢出
        self.processing_cache = {}
        self.rendering_cache = LRUCache(max_size=5000)
        self.workers = {}
        # 缓存命中标记：命中后 line_offsets 来自缓存，无需写回
        self.from_cache = False
        # 性能打点：索引线程启动时刻（LOGLAYER_TIMING=1 时使用）
        self.index_t0: Optional[float] = None
        # 性能打点：管线 worker 启动时刻（LOGLAYER_TIMING=1 时使用）
        self.pipeline_t0: Optional[float] = None

    @property
    def cache(self):
        """Backward compatibility - combined view of both caches."""
        return {**self.processing_cache, **dict(self.rendering_cache.items())}

    def close(self, bridge=None):
        for name, worker in list(self.workers.items()):
            if bridge:
                bridge._retire_worker(worker)
            else:
                if worker.isRunning():
                    worker.stop()
                    worker.wait()
        self.workers.clear()
        if self.mmap:
            try:
                self.mmap.close()
            except:
                pass
            self.mmap = None
        if self.file_obj:
            try:
                self.file_obj.close()
            except:
                pass
            self.file_obj = None


class FileBridge(SearchPipeline, BookmarkPipeline):
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
        self._registry = LayerRegistry()
        self._rg_path = self._get_rg_path()
        # VFS 数据源抽象 + SQLite 元数据缓存（惰性初始化，随工作区确定存储位置）
        self._provider = LocalFileProvider()
        self._workspace_dir = None
        self._cache = None
        self._cache_store = None  # 统一缓存层（内存 LRU + SQLite），随 _cache 惰性构建
        self._cache_size_mb = 2048
        # 工作区统一持久化存储（`.loglayer/workspace.db`，惰性初始化随工作区切换）
        self._workspace_store = None
        self._ensure_cache()
        # Dynamic worker pool sizing
        self._executor_max_workers = 4
        self.executor = ThreadPoolExecutor(max_workers=self._executor_max_workers)
        self._zombie_workers = []
        self._zombie_cleanup_counter = 0  # 清理计数器
        plugin_dir = os.path.join(os.getcwd(), "backend", "plugins")
        self._registry = LayerRegistry(plugin_dir)
        self._registry.discover_plugins()

    def _cache_db_path(self) -> str:
        """缓存数据库路径：一律存工作区 `.loglayer/cache.db`（不用全局目录）。"""
        if self._workspace_dir:
            return os.path.join(self._workspace_dir, ".loglayer", "cache.db")
        return ""

    def _ensure_cache(self) -> None:
        """确保缓存实例存在（惰性初始化 / 工作区已设置）。"""
        if self._cache is not None and self._cache.db_path:
            return
        db_path = self._cache_db_path()
        if not db_path:
            # 尚未设置工作区：缓存暂不落地（等 open_file 自动设置后构建）
            return
        self._cache = SqliteMetadataCache(db_path)
        self._cache.set_cache_size(self._cache_size_mb * 1024 * 1024)

    def _build_cache(self):
        """按当前工作区构建缓存实例。"""
        return SqliteMetadataCache(self._cache_db_path())

    def set_workspace_dir(self, folder_path: str = None) -> None:
        """切换当前工作区，缓存数据库跟随切换到工作区 `.loglayer/cache.db`。

        相同工作区不重复切换；不同工作区则重建缓存连接（旧数据保留在磁盘）。
        工作区统一存储（`.loglayer/workspace.db`）随工作区一起切换。
        """
        folder_path = os.path.abspath(folder_path) if folder_path else None
        if folder_path == self._workspace_dir:
            return
        self._workspace_dir = folder_path
        try:
            if self._cache is not None:
                self._cache.close()
        except Exception:
            pass
        self._cache = None
        self._cache_store = None  # 统一缓存层随 SQLite 缓存一起重建
        # 废弃旧持久化文件（config.json / 首次迁移的 cache.db）
        if folder_path:
            self._cleanup_legacy_files(folder_path)
        self._ensure_cache()
        if self._cache is not None:
            print(f"[Cache] Workspace cache switched to: {self._cache.db_path}")
        # 工作区统一存储切换
        try:
            if self._workspace_store is not None:
                self._workspace_store.close()
        except Exception:
            pass
        self._workspace_store = None
        if folder_path:
            self._get_workspace_store(folder_path)
            print(f"[Workspace] Workspace store switched to: {folder_path}")

    def _cleanup_legacy_files(self, folder_path: str) -> None:
        """废弃旧持久化文件：`.loglayer/config.json` 一律删除；`cache.db` 仅首次迁移删除。

        `cache.db` 仍是索引缓存存储位置，仅当工作区尚无 `workspace.db`
        （即新底座首次启动）时删除旧缓存，随后由新底座按需重建，避免每次启动丢缓存。
        """
        try:
            loglayer_dir = os.path.join(folder_path, ".loglayer")
            if not os.path.isdir(loglayer_dir):
                return
            self._remove_legacy_file(
                os.path.join(loglayer_dir, "config.json"), "Removed legacy config.json: {}"
            )
            if not os.path.exists(os.path.join(loglayer_dir, "workspace.db")):
                self._remove_legacy_file(
                    os.path.join(loglayer_dir, "cache.db"),
                    "Removed legacy cache.db (first migration): {}",
                )
        except Exception as e:
            print(f"[Workspace] Legacy cleanup error: {e}")

    @staticmethod
    def _remove_legacy_file(path: str, log_template: str) -> None:
        """删除一个旧持久化文件；不存在或删除失败时静默返回。"""
        if not os.path.exists(path):
            return
        try:
            os.remove(path)
            print(log_template.format(path))
        except Exception as e:
            print(f"[Workspace] Failed to remove legacy file {path}: {e}")

    def _get_workspace_store(self, folder_path: Optional[str] = None):
        """获取当前工作区的统一存储实例（惰性打开）。

        `folder_path` 为空时使用当前工作区目录；不同工作区则切换连接。
        旧持久化文件清理由 `set_workspace_dir` 负责，此处不做（避免二次删除）。
        """
        root = folder_path or self._workspace_dir
        if not root:
            return None
        root = os.path.abspath(root)
        if self._workspace_store is not None and str(self._workspace_store.root) == root:
            return self._workspace_store
        if self._workspace_store is not None:
            try:
                self._workspace_store.close()
            except Exception:
                pass
        self._workspace_store = WorkspaceStore(root)
        return self._workspace_store

    def _get_cache_store(self):
        """获取统一缓存层实例（惰性构建，复用当前 SQLite 缓存）。

        过滤/搜索计算结果缓存：热数据在内存 LRU、冷数据落 SQLite，
        与 `_cache` 生命周期一致（工作区切换时由 `set_workspace_dir` 重建）。
        """
        if self._cache_store is None and self._cache is not None:
            self._cache_store = CacheStore(self._cache)
        return self._cache_store

    def _current_workspace_store(self, folder_path: Optional[str] = None):
        """切换到指定工作区（可选）并返回其统一存储实例。"""
        if folder_path:
            self.set_workspace_dir(folder_path)
        return self._get_workspace_store()

    # ---------------------------------------------------------------
    # 工作区统一存储 API（布局/书签/设置经 KV，文件历史经 files 表）
    # ---------------------------------------------------------------

    def get_workspace_state(self, key: str, folder_path: Optional[str] = None) -> str:
        """读取一个工作区 KV 状态；不存在返回空字符串。"""
        store = self._current_workspace_store(folder_path)
        if store is None:
            return ""
        return store.get(key) or ""

    def set_workspace_state(self, folder_path: Optional[str], key: str, value: str) -> bool:
        """原子写一个工作区 KV 状态。"""
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return False
            return store.put(key, value)
        except Exception as e:
            print(f"[Workspace] Error setting state: {e}")
            return False

    def get_workspace_files(self, folder_path: Optional[str] = None) -> list:
        """读取工作区文件历史列表。"""
        store = self._current_workspace_store(folder_path)
        if store is None:
            return []
        return store.get_files()

    def set_workspace_files(self, folder_path: Optional[str], files: list) -> bool:
        """事务写工作区文件历史。"""
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return False
            return store.set_files(files)
        except Exception as e:
            print(f"[Workspace] Error setting files: {e}")
            return False

    def get_cache_config(self) -> dict:
        """返回缓存配置与占用情况。"""
        self._ensure_cache()
        if self._cache is None:
            return {"cacheSizeMB": self._cache_size_mb, "totalBytes": 0, "fileCount": 0}
        return {
            "cacheSizeMB": self._cache_size_mb,
            "totalBytes": self._cache.total_bytes(),
            "fileCount": len(self._cache.get_entries()),
        }

    def set_cache_size_mb(self, cache_size_mb: int) -> bool:
        """更新缓存大小（MB）并触发 LRU 淘汰。

        `cache_size_mb` 同时约束三层：SQLite 磁盘存储、偏移数组内存热缓存、
        CacheStore 过滤/搜索内存层（按百分比派生，默认 1%）。
        """
        try:
            self._cache_size_mb = max(1, int(cache_size_mb))
            self._ensure_cache()
            if self._cache is not None:
                self._cache.set_cache_size(self._cache_size_mb * 1024 * 1024)
            if self._cache_store is not None:
                mem_bytes = max(1 * 1024 * 1024, self._cache_size_mb * 1024 * 1024 // 100)
                self._cache_store.set_memory_budget(mem_bytes)
            return True
        except Exception as e:
            print(f"[Cache] set_cache_size error: {e}")
            return False

    def clear_cache(self) -> bool:
        """清空缓存（当前编辑文件除外）。"""
        try:
            self._ensure_cache()
            if self._cache is None:
                return True
            protected = {s.path for s in self._sessions.values()}
            for entry in self._cache.get_entries():
                if entry[0] not in protected:
                    self._cache.invalidate(entry[0])
            return True
        except Exception as e:
            print(f"[Cache] clear error: {e}")
            return False

    def get_worker_config(self) -> dict:
        """Returns current worker pool configuration."""
        return {
            "max_workers": self._executor_max_workers,
            "cpu_count": os.cpu_count() or 4,
        }

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

            print(f"[WorkerPool] Adjusted to {max_workers} workers")
            return True
        except Exception as e:
            print(f"[WorkerPool] Failed to adjust worker count: {e}")
            return False

    def get_platform_info(self) -> str:
        """Returns the current operating system name."""
        return platform.system()

    def _retire_worker(self, worker):
        if not worker:
            return
        if worker in self._zombie_workers:
            # 已在待回收列表：缓存命中路径可能残留已退役引用，避免重复入列/重复连接
            return
        try:
            worker.finished.disconnect()
            worker.error.disconnect()
            if hasattr(worker, "progress"):
                worker.progress.disconnect()
        except:
            pass
        worker.stop()
        self._zombie_workers.append(worker)
        worker.finished.connect(lambda *args: self._cleanup_zombie(worker))
        worker.error.connect(lambda *args: self._cleanup_zombie(worker))
        if not worker.isRunning():
            self._cleanup_zombie(worker)
        else:
            # stop() 后 run() 不再 emit finished，由监视线程等待线程退出后回收
            threading.Thread(
                target=self._reap_worker, args=(worker,), daemon=True
            ).start()

    def _reap_worker(self, worker):
        worker.wait(timeout=10)
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
            # 打印警告如果仍有大量僵尸
            if len(self._zombie_workers) > 10:
                print(
                    f"[Warning] {len(self._zombie_workers)} zombie workers still running"
                )

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
        t0_open = timing_start()
        try:
            if file_id in self._sessions:
                self._sessions[file_id].close(self)

            # 解析文件路径（处理 Windows -> Linux 路径转换）
            resolved_path = resolve_file_path(file_path)

            if not os.path.exists(resolved_path):
                print(f"[Bridge] File not found: {resolved_path}")
                return False

            # 未设置工作区时，以文件所在目录作为工作区（缓存存到该目录 .loglayer/）
            if not self._workspace_dir:
                self.set_workspace_dir(os.path.dirname(resolved_path))
            self._ensure_cache()

            session = LogSession(file_id, resolved_path, self._provider)
            timing("open_file.entry", file_id, t0_open)

            # 缓存查找：命中 → 直接取已反序列化偏移（内存/磁盘两级），跳过重新扫描
            t0_lookup = timing_start()
            offsets = self._cache.get_offsets(resolved_path)
            timing("open_file.cache_lookup", file_id, t0_lookup, f"hit={offsets is not None}")
            if offsets is not None:
                t0_hit = timing_start()
                meta = self._provider.open_mmap(resolved_path)
                self._provider.set_line_offsets(resolved_path, offsets)
                session.size = meta.size_bytes
                session.line_offsets = offsets
                session.mmap = self._provider.get_mmap(resolved_path)
                session.file_obj = self._provider.get_file_obj(resolved_path)
                session.from_cache = True
                self._sessions[file_id] = session
                print(f"[Cache] Hit: {resolved_path} ({len(session.line_offsets)} lines)")
                self.restore_bookmarks(file_id)
                self.fileLoaded.emit(
                    file_id,
                    json.dumps(
                        {
                            "name": self._provider.get_name(resolved_path),
                            "size": session.size,
                            "lineCount": len(session.line_offsets),
                        }
                    ),
                )
                timing("open_file.cache_hit", file_id, t0_hit)
                return True

            try:
                session.size = os.path.getsize(resolved_path)
            except OSError:
                session.size = 0

            if session.size == 0:
                session.line_offsets = array.array("Q")
                self._sessions[file_id] = session
                self.restore_bookmarks(file_id)
                self.fileLoaded.emit(
                    file_id,
                    json.dumps(
                        {
                            "name": self._provider.get_name(resolved_path),
                            "size": 0,
                            "lineCount": 0,
                        }
                    ),
                )
                timing("open_file.cache_hit", file_id, t0_open, "empty-file")
                return True

            t0_miss = timing_start()
            meta = self._provider.open_mmap(resolved_path)
            session.size = meta.size_bytes
            session.mmap = self._provider.get_mmap(resolved_path)
            session.file_obj = self._provider.get_file_obj(resolved_path)
            self._sessions[file_id] = session
            self.restore_bookmarks(file_id)
            self.operationStarted.emit(file_id, "indexing")

            # 单阶段完整索引（无 preview）
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
            timing("open_file.cache_miss", file_id, t0_miss)
            session.index_t0 = timing_start()
            worker.start()
            return True
        except Exception as e:
            print(f"Error opening file: {e}")
            return False

    def _on_indexing_finished(self, file_id, result):
        t0 = timing_start()
        # Handle both old format (list) and new format (dict with partial support)
        if isinstance(result, dict):
            offsets = result.get("offsets", result)
            is_partial = result.get("partial", False)
            # Use line_count if provided, otherwise calculate from offsets
            line_count = (
                result.get("lineCount")
                or result.get("line_count")
                or result.get("total")
                or len(offsets)
            )
        else:
            offsets = result
            is_partial = False
            line_count = len(offsets)

        if file_id not in self._sessions:
            return
        session = self._sessions[file_id]

        # Update offsets - for partial, we still need to set what we have
        if offsets:
            session.line_offsets = offsets
        session.visible_indices = None
        session.processing_cache.clear()
        session.rendering_cache.clear()

        name = (
            session.provider.get_name(session.path)
            if session.provider
            else Path(session.path).name
        )

        # Emit fileLoaded with line count info（先通知前端，缓存写回放后台，避免阻塞打开）
        self.fileLoaded.emit(
            file_id,
            json.dumps(
                {
                    "name": name,
                    "size": session.size,
                    "lineCount": line_count,
                }
            ),
        )
        timing(
            "indexing.finished", file_id, getattr(session, "index_t0", None),
            f"lines={line_count}",
        )
        timing("indexing.notify", file_id, t0)

        # 未命中缓存：索引完成后先注入内存热缓存（同进程二次打开立即命中），
        # 再后台写回 SQLite（序列化+压缩耗时，不阻塞 fileLoaded）
        if not getattr(session, "from_cache", False):
            path = session.path
            offsets_snapshot = session.line_offsets
            self._cache.cache_offsets_memory(path, offsets_snapshot)
            threading.Thread(
                target=self._write_cache,
                args=(path, offsets_snapshot),
                daemon=True,
            ).start()

    def _write_cache(self, file_path: str, offsets) -> None:
        """将行偏移索引分块压缩后写入 SQLite 缓存，并触发 LRU 淘汰。"""
        try:
            blob = SqliteMetadataCache.serialize_offsets(list(offsets))
            index = CachedFileIndex(
                file_hash=SqliteMetadataCache.compute_file_hash(file_path),
                line_count=len(offsets),
                offsets_blob=blob,
                file_size=os.path.getsize(file_path),
            )
            self._cache.put(file_path, index)
            # 当前编辑中的文件豁免淘汰
            protected = {s.path for s in self._sessions.values()}
            self._cache.enforce_limit(protected=protected)
        except Exception as e:
            print(f"[Cache] Write error: {e}")

    def sync_all(self, file_id: str, layers_json: str, search_json: str) -> bool:
        """Legacy API - delegates to sync_layers for backward compatibility"""
        return self.sync_layers(file_id, layers_json, search_json)

    def _merge_system_layers(self, session, new_layers: list) -> list:
        """保持 session 中既有的系统托管图层（如书签）不被前端同步覆盖"""
        system_layers = [l for l in session.layers if l.get("isSystemManaged")]
        incoming_ids = {l.get("id") for l in new_layers}
        for sl in system_layers:
            if sl.get("id") not in incoming_ids:
                new_layers.append(sl)
        return new_layers

    def sync_layers(self, file_id: str, layers_json: str, search_json: str) -> bool:
        """
        同步处理层配置。
        触发完整的 PipelineWorker 重新计算可见行。
        """
        if file_id not in self._sessions:
            return False
        session = self._sessions[file_id]
        try:
            incoming = json.loads(layers_json)
            session.layers = self._merge_system_layers(session, incoming)
            session.search_config = json.loads(search_json) if search_json else None

            # 分离处理层和渲染层实例
            session.layer_instances = []
            session.rendering_instances = []

            for l_conf in session.layers:
                if l_conf.get("enabled"):
                    inst = self._registry.create_layer_instance(
                        l_conf["type"], l_conf["config"]
                    )
                    if inst:
                        inst.id = l_conf.get("id")
                        # 根据类别分类
                        if self._registry.is_rendering_layer(l_conf["type"]):
                            session.rendering_instances.append(inst)
                        else:
                            session.layer_instances.append(inst)

            # 只传递处理层给 Pipeline
            self._start_pipeline(file_id, session.layer_instances)
            return True
        except Exception as e:
            print(f"Sync layers error: {file_id}: {e}")
            self.operationError.emit(file_id, "sync", str(e))
            self.operationStatusChanged.emit(file_id, "ready", 100)
            return False

    def _emit_refresh_signal(self, file_id: str):
        """Emit pipeline finished signal with current indices count.

        Used by sync_decorations and bookmark operations for lightweight refresh.
        """
        if file_id not in self._sessions:
            return
        session = self._sessions[file_id]
        indices_len = (
            len(session.visible_indices)
            if session.visible_indices is not None
            else len(session.line_offsets)
        )
        matches_len = (
            len(session.search_matches) if session.search_matches is not None else 0
        )
        self.pipelineFinished.emit(file_id, indices_len, matches_len)

    def sync_decorations(self, file_id: str, layers_json: str) -> bool:
        """
        同步渲染层配置。
        只刷新渲染缓存，不重新计算可见行。
        这是一个轻量级操作，用于快速响应高亮/行背景等变更。
        """
        if file_id not in self._sessions:
            return False
        session = self._sessions[file_id]
        try:
            incoming = json.loads(layers_json)
            session.layers = self._merge_system_layers(session, incoming)

            # 只更新渲染层实例
            session.rendering_instances = []
            for l_conf in session.layers:
                if l_conf.get("enabled") and self._registry.is_rendering_layer(
                    l_conf["type"]
                ):
                    inst = self._registry.create_layer_instance(
                        l_conf["type"], l_conf["config"]
                    )
                    if inst:
                        inst.id = l_conf.get("id")
                        session.rendering_instances.append(inst)

            # 清除渲染缓存（轻量级操作，只影响视觉效果）
            session.rendering_cache.clear()

            # 发送刷新信号 (不改变可见行数)
            self._emit_refresh_signal(file_id)

            # 更新统计（仅针对有查询的渲染层）
            if any(
                hasattr(inst, "query") and inst.query
                for inst in session.rendering_instances
            ):
                stat_worker = StatsWorker(
                    self._rg_path,
                    session.rendering_instances,
                    session.path,
                    len(session.line_offsets),
                    session.search_config,
                )
                session.workers["stats"] = stat_worker
                stat_worker.finished.connect(
                    lambda stats: self.statsFinished.emit(file_id, stats)
                )
                stat_worker.start()

            return True
        except Exception as e:
            print(f"Sync decorations error: {file_id}: {e}")
            return False

    def _start_pipeline(self, file_id, layer_instances):
        t0 = timing_start()
        if file_id not in self._sessions:
            return
        session = self._sessions[file_id]
        if "pipeline" in session.workers:
            self._retire_worker(session.workers["pipeline"])
        if "stats" in session.workers:
            self._retire_worker(session.workers["stats"])
        timing("pipeline.start", file_id, t0)

        has_search = bool(session.search_config and session.search_config.get("query"))

        # 过滤/搜索缓存：同文件同配置命中则跳过对应计算
        cache_store = self._get_cache_store()
        cache_hit = False
        cached_visible = None
        search_hit = False
        cached_matches = None
        session._pipeline_from_cache = False
        session._search_from_cache = False
        t0_cache = timing_start()
        if cache_store is not None and layer_instances:
            session.layers_hash = compute_layers_hash(session.layers)
            cache_hit, cached_visible = cache_store.get_pipeline(
                session.path, session.layers_hash
            )
        else:
            session.layers_hash = None
        if cache_store is not None and has_search:
            session.query_hash = compute_query_hash(session.search_config)
            search_hit, cached_matches = cache_store.get_search(
                session.path, session.query_hash
            )
        else:
            session.query_hash = None
        timing(
            "pipeline.cache_lookup", file_id, t0_cache,
            f"filter_hit={cache_hit} search_hit={search_hit}",
        )

        if cache_hit and search_hit:
            # 双命中：过滤与搜索均恢复自缓存，无 worker
            session.visible_indices = cached_visible
            session.search_matches = cached_matches
            session.processing_cache.clear()
            session.rendering_cache.clear()
            session._pipeline_from_cache = True
            session._search_from_cache = True
            indices_len = (
                len(cached_visible)
                if cached_visible is not None
                else len(session.line_offsets)
            )
            matches_len = len(cached_matches) if cached_matches is not None else 0
            self.pipelineFinished.emit(file_id, indices_len, matches_len)
            self.operationStatusChanged.emit(file_id, "ready", 100)
            timing("pipeline.worker_start", file_id, t0, "mode=cache-both")
        elif cache_hit:
            # 过滤缓存命中：恢复可见行集，清缓存；有搜索词则仅计算搜索匹配
            session.visible_indices = cached_visible
            session.processing_cache.clear()
            session.rendering_cache.clear()
            session._pipeline_from_cache = True
            if has_search:
                self.operationStarted.emit(file_id, "pipeline")
                worker = PipelineWorker(
                    self._rg_path,
                    session.path,
                    [],
                    session.search_config,
                    skip_filter=True,
                    precomputed_visible=cached_visible,
                )
                session.workers["pipeline"] = worker
                worker.finished.connect(
                    lambda indices, matches: self._on_pipeline_finished(
                        file_id, indices, matches
                    )
                )
                worker.error.connect(
                    lambda e: self.operationError.emit(file_id, "pipeline", e)
                )
                session.pipeline_t0 = timing_start()
                worker.start()
                timing("pipeline.worker_start", file_id, t0, "mode=filter-cache-search")
            else:
                session.search_matches = None
                indices_len = (
                    len(cached_visible)
                    if cached_visible is not None
                    else len(session.line_offsets)
                )
                self.pipelineFinished.emit(file_id, indices_len, 0)
                self.operationStatusChanged.emit(file_id, "ready", 100)
                timing("pipeline.worker_start", file_id, t0, "mode=filter-cache")
        elif not layer_instances and not has_search:
            session.visible_indices = None
            session.search_matches = None
            session.processing_cache.clear()
            session.rendering_cache.clear()
            self.pipelineFinished.emit(file_id, len(session.line_offsets), 0)
            self.operationStatusChanged.emit(file_id, "ready", 100)
            timing("pipeline.worker_start", file_id, t0, "mode=empty")
        else:
            # 搜索命中：匹配来自缓存（precomputed_matches 透传），写回时跳过避免重复计数
            session._search_from_cache = search_hit
            self.operationStarted.emit(file_id, "pipeline")
            worker = PipelineWorker(
                self._rg_path,
                session.path,
                layer_instances,
                session.search_config,
                precomputed_matches=cached_matches if search_hit else None,
            )
            session.workers["pipeline"] = worker
            worker.finished.connect(
                lambda indices, matches: self._on_pipeline_finished(
                    file_id, indices, matches
                )
            )
            worker.error.connect(
                lambda e: self.operationError.emit(file_id, "pipeline", e)
            )
            session.pipeline_t0 = timing_start()
            worker.start()
            timing("pipeline.worker_start", file_id, t0, "mode=compute")
        if any(
            l.get("enabled") and l.get("type") in ["HIGHLIGHT", "FILTER", "LEVEL"]
            for l in session.layers
        ) or has_search:
            stat_worker = StatsWorker(
                self._rg_path,
                session.layer_instances,
                session.path,
                len(session.line_offsets),
                session.search_config,
            )
            session.workers["stats"] = stat_worker
            stat_worker.finished.connect(
                lambda stats: self.statsFinished.emit(file_id, stats)
            )
            stat_worker.start()
        else:
            self.statsFinished.emit(file_id, json.dumps({}))

    def get_layer_registry(self) -> str:
        return json.dumps(self._registry.get_all_types())

    def get_diagnostics(self) -> str:
        """诊断接口（可观测，3.4）：缓存命中统计 + 各文件最近管线阶段耗时。"""
        cache_store = self._get_cache_store()
        stats = cache_store.get_stats() if cache_store is not None else {}
        sessions_info = {}
        for fid, session in self._sessions.items():
            worker = session.workers.get("pipeline")
            timing = getattr(worker, "timing", None) if worker else None
            sessions_info[fid] = {
                "path": getattr(session, "path", ""),
                "timing": timing or {},
                "matches": len(session.search_matches) if session.search_matches is not None else 0,
                "visible": len(session.visible_indices) if session.visible_indices is not None else None,
            }
        return json.dumps({"cache_stats": stats, "sessions": sessions_info})

    def _calculate_log_level_stats(self, file_path: str) -> dict:
        """Calculate log level statistics for a file using ripgrep"""
        log_levels = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE", "FATAL"]
        results = {level: 0 for level in log_levels}

        try:
            # 单次 ripgrep 扫描同时提取全部级别关键字（-o 每处匹配输出一行），
            # 避免 6 次串行子进程启动 + 重复读文件。
            pattern = "\\b(" + "|".join(log_levels) + ")\\b"
            cmd = [
                self._rg_path,
                "-i",  # case insensitive
                "-o",
                "--no-line-number",
                "-e",
                pattern,
                file_path,
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                creationflags=get_creationflags(),
                timeout=30,
            )
            # returncode 0 = 有匹配；1 = 无匹配；其他为错误
            if result.returncode in (0, 1):
                for line in result.stdout.splitlines():
                    level = line.strip().upper()
                    if level in results:
                        results[level] += 1
            else:
                print(
                    f"[LogLevelStats] rg error (rc={result.returncode}): {result.stderr[:200]}"
                )
            for level in log_levels:
                timing(f"stats.level.{level}", "", None, f"count={results[level]}")
        except Exception as e:
            print(f"[LogLevelStats] Error calculating stats: {e}")
            for level in log_levels:
                results[level] = 0

        return results

    def get_log_level_stats(self, file_id: str) -> str:
        """Get log level statistics for a file"""
        if file_id not in self._sessions:
            return json.dumps({})

        t0 = timing_start()
        session = self._sessions[file_id]
        stats = self._calculate_log_level_stats(session.path)
        timing("stats.total", file_id, t0)
        return json.dumps(stats)

    def reload_plugins(self) -> bool:
        self._registry.discover_plugins()
        return True

    def _on_pipeline_finished(self, file_id, visible_indices, search_matches):
        if file_id not in self._sessions:
            return
        session = self._sessions[file_id]
        session.visible_indices = visible_indices
        session.search_matches = search_matches
        indices_len = (
            len(visible_indices)
            if visible_indices is not None
            else len(session.line_offsets)
        )
        matches_len = len(search_matches) if search_matches is not None else 0
        session.processing_cache.clear()
        session.rendering_cache.clear()
        # 过滤结果写回缓存（仅真实管线计算后；缓存命中路径跳过，避免污染统计）
        if session.layers_hash and not session._pipeline_from_cache:
            cache_store = self._get_cache_store()
            if cache_store is not None:
                cache_store.put_pipeline(
                    session.path, session.layers_hash, session.visible_indices
                )
        # 搜索匹配写回缓存（仅真实计算路径；搜索缓存命中路径跳过）
        if session.query_hash and not session._search_from_cache:
            cache_store = self._get_cache_store()
            if cache_store is not None and search_matches is not None:
                cache_store.put_search(
                    session.path, session.query_hash, search_matches
                )
        self.pipelineFinished.emit(file_id, indices_len, matches_len)
        self.operationStatusChanged.emit(file_id, "ready", 100)
        timing(
            "pipeline.finished", file_id, getattr(session, "pipeline_t0", None),
            f"indices={indices_len} matches={matches_len}",
        )

    # Search methods have been moved to SearchMixin

    def read_processed_lines(self, file_id: str, start_line: int, count: int) -> str:
        t0 = timing_start()
        if file_id not in self._sessions:
            return "[]"
        session = self._sessions[file_id]
        try:
            if session.mmap is None or session.mmap.closed:
                return "[]"
            _ = len(session.mmap)  # 验证 mmap 仍然有效
            if start_line < 0:
                return "[]"
            results = []
            v_indices = session.visible_indices
            offsets = session.line_offsets
            total = len(v_indices) if v_indices is not None else len(offsets)
            end_idx = min(start_line + count, total)
            for i in range(start_line, end_idx):
                if i in session.rendering_cache:
                    results.append(session.rendering_cache[i])
                    continue
                try:
                    real_idx = v_indices[i] if v_indices is not None else i
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

                    # 应用处理层的内容变换（仅 Transform 类型的图层允许修改内容）
                    logic_layers = [
                        l
                        for l in session.layer_instances
                        if l.stage == LayerStage.LOGIC
                    ]
                    current_offset_map = None

                    for layer in logic_layers:
                        res = layer.process_line(content)
                        if isinstance(res, ProcessedLine):
                            content = res.content
                            # 这里可以累加 offset_map，如果多个转换层叠加
                            if res.offset_map:
                                current_offset_map = res.offset_map
                        else:
                            content = res

                    # 图层高亮/行样式与搜索高亮由前端渲染器按可见行即时计算（2.6），后端不再下发
                    line_data = {
                        "index": real_idx,
                        "content": content,
                    }
                    # LRU Cache 会自动处理容量限制
                    session.rendering_cache[i] = line_data
                    results.append(line_data)
                except (IndexError, ValueError):
                    continue
            timing("read_lines", file_id, t0, f"rows={len(results)}")
            return json.dumps(results)
        except (ValueError, RuntimeError) as e:
            print(f"Session error for {file_id}: {e}")
            return "[]"

    def list_directory(self, folder_path: str) -> str:
        return json.dumps(get_directory_contents(folder_path))

    def save_workspace_config(self, folder_path: str, config_json: str) -> bool:
        """兼容壳：解析旧 config JSON，转写入统一工作区存储（files 表 + activeFilePath）。

        前端 `useWorkspaceConfig` 仍调用本方法保存文件历史；新底座接管存储，
        `config.json` 不再作为写入目标。
        """
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return False
            config = json.loads(config_json)
            files = config.get("files") or []
            if files:
                store.set_files(files)
            store.put("activeFilePath", config.get("activeFilePath") or "")
            return True
        except Exception as e:
            print(f"[Workspace] Error saving config: {e}")
            return False

    def load_workspace_config(self, folder_path: str) -> str:
        """兼容壳：从统一工作区存储读取文件历史，重建旧 config JSON 格式返回。

        `WorkspaceConfig.files[]` 的 schema 与读写由统一底座接管。
        """
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return ""
            files = store.get_files()
            if not files:
                return ""
            active = store.get("activeFilePath") or ""
            config = {
                "version": 2,
                "lastModified": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "files": files,
                "activeFilePath": active or None,
            }
            return json.dumps(config, ensure_ascii=False)
        except Exception as e:
            print(f"[Workspace] Error loading config: {e}")
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
            print(f"get_lines_by_indices error for {file_id}: {e}")
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
            try:
                self._provider.close(session.path)
            except Exception as e:
                print(f"[Bridge] Provider close error for {session.path}: {e}")
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
                print(f"[Bridge] select_files error: {e}")
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
                print(f"[Bridge] select_folder error: {e}")
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

    # SearchMixin provides:
    # get_search_match_index, get_nearest_search_rank, get_search_matches_range,
    # toggle_bookmark, get_bookmarks, get_nearest_bookmark_index, clear_bookmarks,
    # physical_to_visual_index, update_bookmark_comment
