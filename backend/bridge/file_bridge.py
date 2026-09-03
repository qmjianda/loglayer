"""FileBridge 主类：文件会话管理、索引、管线调度、信号广播。

从原 bridge.py 拆出（refactor-bridge-module）。依赖见包内兄弟模块：
utils/cache/signal/search_matching/workers/session。
"""

import os
import sys
import mmap
import array
import json
import re
import subprocess
import threading
import time
import platform
from pathlib import Path
import importlib
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

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

from .signal import Signal
from .session import LogSession
from .utils import (
    timing_start,
    timing,
    resolve_file_path,
    find_rg_binary,
    get_creationflags,
    get_directory_contents,
)
from .workers import PipelineWorker, IndexingWorker, StatsWorker, PROCESS_CLEANUP_TIMEOUT


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
        if getattr(sys, "frozen", False):
            plugin_dir = Path(sys.executable).resolve().parent / "plugins"
        else:
            plugin_dir = Path(__file__).resolve().parents[2] / "examples" / "plugins"
        self._registry.plugin_dir = plugin_dir
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

    @staticmethod
    def _to_stored_path(root: Optional[str], abs_path: str) -> str:
        """将绝对路径转为相对工作区根的 POSIX 路径（历史存储形式）。

        工作区内：`os.path.relpath(abs_path, root)` + `Path.as_posix()`（统一 `/` 分隔符）；
        无法相对化（跨盘 relpath 抛 ValueError、结果以 `..` 开头即工作区外、
        或 root 为空）时返回原绝对路径原样存储（读取端 isabs 判断自然兼容）。
        """
        if not root or not abs_path:
            return abs_path
        try:
            rel = os.path.relpath(abs_path, root)
        except ValueError:
            # 跨盘（如 Windows D: vs E:）相对化无意义
            return abs_path
        if rel.startswith(".."):
            # 工作区外（`..` 溢出）或本身以 .. 开头的文件：绝对路径兜底
            return abs_path
        return Path(rel).as_posix()

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
        """事务写工作区文件历史（写入前将路径相对化存储）。"""
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return False
            stored_files = []
            for entry in files:
                stored = dict(entry)
                stored["path"] = self._to_stored_path(
                    folder_path, stored.get("path") or ""
                )
                stored_files.append(stored)
            return store.set_files(stored_files)
        except Exception as e:
            print(f"[Workspace] Error setting files: {e}")
            return False

    def remove_workspace_file(self, folder_path: Optional[str], path: str) -> bool:
        """从工作区文件历史中删除单条记录（幂等，绝对/相对双形式匹配）。

        DB 中存的可能为相对路径（新数据）或绝对路径（旧数据/工作区外兜底），
        调用方传绝对或相对均可命中：先按传入 path 删，再按相对化结果删一次。
        """
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return False
            store.delete_file(path)
            stored = self._to_stored_path(folder_path, path)
            if stored != path:
                store.delete_file(stored)
            return True
        except Exception as e:
            print(f"[Workspace] Error removing file: {e}")
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
        """定位可用的 ripgrep 二进制；找不到时返回 None（调用方需降级）。"""
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            base_dir = sys._MEIPASS
        else:
            # 拆分后本文件位于 backend/bridge/，向上两级回到 backend/
            # （与拆分前 bridge.py 位于 backend/ 时的 dirname 行为一致）
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        bundled_bin = os.path.join(base_dir, "bin")
        dev_bin = os.path.join(os.path.dirname(base_dir), "bin")
        rg_path = find_rg_binary([bundled_bin, dev_bin])
        if rg_path is None:
            print(
                "[Bridge] ripgrep not found in bundled/dev dirs or PATH; "
                "log-level stats will use Python fallback"
            )
        return rg_path

    def open_file(self, file_id: str, file_path: str) -> bool:
        t0_open = timing_start()
        try:
            if file_id in self._sessions:
                self._sessions[file_id].close(self)

            # 解析文件路径（Path 规范化 + 裸文件名基于 cwd 归一化）
            resolved_path = resolve_file_path(file_path)

            if not os.path.exists(resolved_path):
                # 历史路径失效：非静默失败，不自动递归扫描工作区找同名文件
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

        # rg 不可用（未找到二进制 / 路径失效）时返回全 0 并告警，
        # 不做慢速替代（大文件逐行统计违反性能红线）。
        if not self._rg_path or not os.path.isfile(self._rg_path):
            print(
                "[LogLevelStats] rg unavailable, returning zero stats "
                f"for {file_path}"
            )
            return results

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
        return self._registry.reload_plugins()

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
        # LOGLAYER_DEBUG 门控：关闭时零开销（不拼接字符串）
        _debug = os.environ.get("LOGLAYER_DEBUG") == "1"
        if file_id not in self._sessions:
            if _debug:
                print(f"[Read] fileId={file_id} range=[{start_line},{start_line+count}) total=0 mmap=None v_indices=None cacheHit=0 skipped=0")
            return "[]"
        session = self._sessions[file_id]
        try:
            if session.mmap is None or getattr(session.mmap, "closed", False):
                if _debug:
                    mmap_state = "None" if session.mmap is None else "closed"
                    print(f"[Read] fileId={file_id} range=[{start_line},{start_line+count}) total=0 mmap={mmap_state} v_indices=None cacheHit=0 skipped=0")
                return "[]"
            _ = len(session.mmap)  # 验证 mmap 仍然有效
            if start_line < 0:
                if _debug:
                    print(f"[Read] fileId={file_id} range=[{start_line},{start_line+count}) total=0 mmap=ok v_indices=None cacheHit=0 skipped=0")
                return "[]"
            v_indices = session.visible_indices
            offsets = session.line_offsets
            total = len(v_indices) if v_indices is not None else len(offsets)
            end_idx = min(start_line + count, total)
            # 定长语义：结果长度 == end_idx - start_line，无法提供的位置以 null 占位
            expected = end_idx - start_line
            if expected <= 0:
                if _debug:
                    print(f"[Read] fileId={file_id} range=[{start_line},{end_idx}) total={total} mmap=ok v_indices={len(v_indices) if v_indices is not None else None} cacheHit=0 skipped=0")
                return "[]"
            results: list = [None] * expected  # type: ignore
            skipped = 0
            cache_hit = 0
            for idx, i in enumerate(range(start_line, end_idx)):
                if i in session.rendering_cache:
                    results[idx] = session.rendering_cache[i]
                    cache_hit += 1
                    continue
                try:
                    real_idx = v_indices[i] if v_indices is not None else i
                    if real_idx >= len(offsets):
                        skipped += 1
                        results[idx] = None
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
                    results[idx] = line_data
                except (IndexError, ValueError):
                    skipped += 1
                    results[idx] = None
                    continue
            if _debug:
                print(f"[Read] fileId={file_id} range=[{start_line},{end_idx}) total={total} mmap=ok v_indices={len(v_indices) if v_indices is not None else None} cacheHit={cache_hit} skipped={skipped} rows={len(results)}")
            timing("read_lines", file_id, t0, f"rows={len(results)} skipped={skipped}")
            return json.dumps(results)
        except (ValueError, RuntimeError) as e:
            print(f"Session error for {file_id}: {e}")
            return "[]"

    def list_directory(self, folder_path: str) -> str:
        return json.dumps(get_directory_contents(folder_path))

    def save_workspace_config(self, folder_path: str, config_json: str) -> bool:
        """兼容壳：解析旧 config JSON，转写入统一工作区存储（files 表 + activeFilePath）。

        前端 `useWorkspaceConfig` 仍调用本方法保存文件历史；新底座接管存储，
        `config.json` 不再作为写入目标。写入前将 files[] 与 activeFilePath
        转为相对工作区根的存储形式（工作区外/跨盘条目兜底存绝对路径）。
        """
        try:
            store = self._current_workspace_store(folder_path)
            if store is None:
                return False
            config = json.loads(config_json)
            files = config.get("files") or []
            if files:
                stored_files = []
                for entry in files:
                    stored = dict(entry)
                    stored["path"] = self._to_stored_path(
                        folder_path, stored.get("path") or ""
                    )
                    stored_files.append(stored)
                store.set_files(stored_files)
            active = config.get("activeFilePath") or ""
            store.put(
                "activeFilePath",
                self._to_stored_path(folder_path, active) if active else "",
            )
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
        # 桌面壳插槽：注入对象需实现 create_file_dialog(kind, allow_multiple, file_types)
        # kind 约定：0=OPEN（多选文件）、1=FOLDER（pywebview FileDialog 数值语义）
        if hasattr(self, "window"):
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
            path = self.window.create_file_dialog(1)
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
        from .utils import get_log_files_recursive

        return json.dumps(get_log_files_recursive(folder_path))

    # SearchMixin provides:
    # get_search_match_index, get_nearest_search_rank, get_search_matches_range,
    # toggle_bookmark, get_bookmarks, get_nearest_bookmark_index, clear_bookmarks,
    # physical_to_visual_index, update_bookmark_comment
