"""
Worker Registry - Manages background worker threads lifecycle.
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional, Callable
import logging

logger = logging.getLogger(__name__)


class WorkerRegistry:
    """
    Manages background worker threads.

    Extracts worker lifecycle from FileBridge to follow Single Responsibility Principle.
    """

    def __init__(self, executor: ThreadPoolExecutor):
        self._executor = executor
        self._zombie_workers: list = []
        self._cleanup_counter = 0
        self._on_worker_finished: Optional[Callable] = None

    def set_finished_callback(self, callback: Callable):
        self._on_worker_finished = callback

    def create_indexing_worker(self, mmap_obj, size: int, file_path: str):
        from workers import IndexingWorker

        worker = IndexingWorker(mmap_obj, size, file_path)
        worker.finished.connect(lambda offsets: self._on_worker_done(worker, "indexing", offsets))
        return worker

    def create_pipeline_worker(
        self, rg_path: str, file_path: str, layers: list, search_config: Optional[dict] = None
    ):
        from workers import PipelineWorker

        worker = PipelineWorker(rg_path, file_path, layers, search_config)
        worker.finished.connect(
            lambda indices, matches: self._on_pipeline_done(worker, indices, matches)
        )
        return worker

    def create_stats_worker(
        self,
        rg_path: str,
        layers: list,
        file_path: str,
        total_lines: int,
        search_config: Optional[dict] = None,
    ):
        from workers import StatsWorker

        worker = StatsWorker(rg_path, layers, file_path, total_lines, search_config)
        worker.finished.connect(lambda stats: self._on_stats_done(worker, stats))
        return worker

    def _on_worker_done(self, worker, name: str, result: Any):
        if self._on_worker_finished:
            self._on_worker_finished(name, result)

    def _on_pipeline_done(self, worker, indices, matches):
        if self._on_worker_finished:
            self._on_worker_finished("pipeline", (indices, matches))

    def _on_stats_done(self, worker, stats: str):
        if self._on_worker_finished:
            self._on_worker_finished("stats", stats)

    def retire(self, worker):
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
        if worker in self._zombie_workers:
            self._zombie_workers.remove(worker)
        self._cleanup_counter += 1
        if self._cleanup_counter >= 5:
            self._cleanup_counter = 0
            for w in list(self._zombie_workers):
                if not w.isRunning():
                    w.wait(timeout=0.5)
                    self._zombie_workers.remove(w)

    def submit_task(self, fn, *args, **kwargs):
        return self._executor.submit(fn, *args, **kwargs)


__all__ = ["WorkerRegistry"]
