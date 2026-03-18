"""
Workers module - Thread-based workers for background processing.
"""

import os
import re
import json
import array
import time
import threading
import subprocess
import logging
from concurrent.futures import ThreadPoolExecutor

from logging_config import logger

PROCESS_CLEANUP_TIMEOUT = 2


def get_creationflags():
    if os.name == "nt":
        import subprocess

        return subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    return 0


class Signal:
    """Thread-safe event emitter."""

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
                logger.error(f"Error in signal callback: {e}")


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
    """Worker for indexing log file line offsets using mmap."""

    FAST_PREVIEW_BYTES = 10 * 1024 * 1024  # 10MB for quick preview
    # Memory limit: stop full indexing when offsets exceed this size (~400MB for 50M lines)
    MAX_OFFSETS_SIZE = 50_000_000
    # Use sparse indexing for files exceeding limit (store every Nth offset)
    SPARSE_INTERVAL = 100

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

            preview_bytes = min(self.size, self.FAST_PREVIEW_BYTES)
            logger.info(f"[Indexing] Starting: file_size={self.size}, preview_bytes={preview_bytes}")

            # Phase 1: Quick preview (first N MB) - show content immediately
            preview_bytes = min(self.size, self.FAST_PREVIEW_BYTES)
            for m in re.finditer(b"\n", self.mmap[:preview_bytes]):
                if self.is_cancelled():
                    return
                offsets.append(m.start() + 1)
                scanned += 1

            preview_count = scanned
            preview_time = time.time() - start_time

            # Send preview immediately - MUST copy the array to avoid memory aliasing
            preview_offsets = array.array("Q", offsets)
            self.finished.emit(
                {
                    "offsets": preview_offsets,
                    "partial": True,
                    "lineCount": preview_count,
                }
            )
            logger.info(f"[Indexing] Preview: {preview_count} lines in {preview_time:.2f}s")
            self.progress.emit(10)

            # Phase 2: Continue full indexing in background
            if not self.is_cancelled() and self.size > preview_bytes:
                last_offset = offsets[-1]

                for m in re.finditer(b"\n", self.mmap[last_offset:]):
                    if self.is_cancelled():
                        return
                    offsets.append(last_offset + m.start() + 1)
                    scanned += 1

                    # Check memory limit - if too many offsets, switch to sparse mode
                    if scanned > self.MAX_OFFSETS_SIZE:
                        logger.warning(
                            f"[Indexing] File too large ({scanned} lines), switching to sparse indexing"
                        )
                        self._finish_with_sparse(offsets, scanned, start_time)
                        return

                    if scanned % 1000000 == 0:
                        progress = 10 + (scanned / max(1, self.size / 80) * 90)
                        self.progress.emit(min(100, progress))
                        logger.info(f"[Indexing] Progress: {scanned} lines scanned")

            # Cleanup tail
            if len(offsets) > 1 and offsets[-1] >= self.size:
                offsets.pop()

            total_time = time.time() - start_time
            speed_mbps = self.size / total_time / 1024 / 1024
            logger.info(
                f"[Indexing] Complete: scanned={scanned}, len(offsets)={len(offsets)} in {total_time:.2f}s ({speed_mbps:.1f} MB/s)"
            )
            self.finished.emit(
                {
                    "offsets": offsets,
                    "partial": False,
                    "lineCount": scanned,
                    "sparse": False,
                }
            )

        except Exception as e:
            self.error.emit(str(e))

    def _finish_with_sparse(self, current_offsets, scanned, start_time):
        sparse_offsets = array.array("Q", [0])
        for i in range(0, len(current_offsets), self.SPARSE_INTERVAL):
            sparse_offsets.append(current_offsets[i])

        if len(sparse_offsets) == 0 or sparse_offsets[-1] != current_offsets[-1]:
            sparse_offsets.append(current_offsets[-1])

        total_time = time.time() - start_time
        logger.info(
            f"[Indexing] Sparse: {len(sparse_offsets)} index points for {scanned} lines in {total_time:.2f}s"
        )

        self.finished.emit(
            {
                "offsets": sparse_offsets,
                "partial": False,
                "lineCount": scanned,
                "sparse": True,
                "sparseInterval": self.SPARSE_INTERVAL,
            }
        )


class PipelineWorker(CustomThread):
    def __init__(self, rg_path, file_path, layers, search_config=None):
        super().__init__()
        self.finished = Signal(object, object)
        self.progress = Signal(float)
        self.error = Signal(str)
        self.rg_path = rg_path
        self.file_path = file_path
        self.layers = layers
        self.search = search_config
        self._is_running = True
        self._processes = []

    def run(self):
        from loglayer.core import LayerStage, ProcessedLine
        
        logger.info(f"[PipelineWorker] Starting pipeline for {self.file_path}, native_layers={len([l for l in self.layers if l.stage == LayerStage.NATIVE])}, logic_layers={len([l for l in self.layers if l.stage == LayerStage.LOGIC])}")

        try:
            native_layers = [l for l in self.layers if l.stage == LayerStage.NATIVE]
            logic_layers = [l for l in self.layers if l.stage == LayerStage.LOGIC]

            matching_physicals = set()
            if self.search and self.search.get("query"):
                search_cmd = [
                    self.rg_path,
                    "--line-number",
                    "--no-heading",
                    "--no-filename",
                    "--color",
                    "never",
                    "-a",  # 将二进制文件当作文本处理
                ]
                if self.search.get("regex"):
                    search_cmd.append("-e")
                else:
                    search_cmd.append("-F")
                if not self.search.get("caseSensitive"):
                    search_cmd.append("-i")
                if self.search.get("wholeWord"):
                    search_cmd.append("-w")
                search_cmd.append(self.search["query"])
                search_cmd.append(self.file_path)

                try:
                    sp = subprocess.Popen(
                        search_cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=False,
                        creationflags=get_creationflags(),
                    )
                    if sp.stdout:
                        for match_line_bytes in sp.stdout:
                            if self.is_cancelled():
                                break
                            match_line = match_line_bytes.decode(
                                "utf-8", errors="replace"
                            )
                            parts = match_line.split(":", 1)
                            if parts[0].isdigit():
                                matching_physicals.add(int(parts[0]) - 1)
                    sp.wait(timeout=5)
                except Exception as e:
                    logger.error(f"[Pipeline] Search match calculation error: {e}")

            if not native_layers and not logic_layers:
                visible_indices = None
                search_matches = (
                    array.array("I", sorted(list(matching_physicals)))
                    if matching_physicals
                    else array.array("I")
                )
                if self._is_running:
                    self.finished.emit(visible_indices, search_matches)
                return

            cmd_chain = []

            def build_rg_cmd(args, is_first, is_last_native):
                cmd = [
                    self.rg_path,
                    "--no-heading",
                    "--no-filename",
                    "--color",
                    "never",
                    "--binary",  # 匹配二进制文件中的字符串
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
            search_matches = array.array("I")
            v_idx = 0
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
                            # Only call process_line if the layer has this method (TransformLayer, etc.)
                            if hasattr(layer, 'process_line'):
                                res = layer.process_line(content)
                                content = (
                                    res.content if isinstance(res, ProcessedLine) else res
                                )
                            # Only call filter_line if the layer has this method (FilterLayer, RangeLayer, TimeLayer, etc.)
                            if hasattr(layer, 'filter_line'):
                                if not layer.filter_line(content, index=physical_idx):
                                    is_visible = False
                                    break

                    if is_visible:
                        visible_indices.append(physical_idx)
                        if physical_idx in matching_physicals:
                            search_matches.append(v_idx)
                        v_idx += 1

                    line_count += 1
                    if line_count % 10000 == 0:
                        self.progress.emit(float(line_count))  # Emit actual line count for progress tracking

            if self._is_running:
                logger.info(f"[PipelineWorker] Pipeline completed: {len(visible_indices)} visible lines, {len(search_matches)} search matches")
                self.finished.emit(visible_indices, search_matches)

        except Exception as e:
            if self._is_running:
                logger.error(f"[PipelineWorker] Pipeline error: {e}")
                self.error.emit(str(e))
        finally:
            self._cleanup_processes()

    def _cleanup_processes(self, timeout=PROCESS_CLEANUP_TIMEOUT):
        for p in self._processes:
            try:
                if p.poll() is None:
                    p.terminate()
            except (OSError, subprocess.SubprocessError):
                pass
        for p in self._processes:
            try:
                p.wait(timeout=timeout)
            except (OSError, subprocess.TimeoutExpired):
                try:
                    p.kill()
                except (OSError, subprocess.SubprocessError):
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

            if self.search_config and self.search_config.get("query"):
                tasks.append((None, "search", self.search_config, []))

            with ThreadPoolExecutor(
                max_workers=min(2, os.cpu_count() or 4)
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
                        logger.error(f"Stats task error: {e}")
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
                    head_cmd,
                    stdout=subprocess.PIPE,
                    creationflags=get_creationflags(),
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
                except (OSError, subprocess.SubprocessError):
                    pass
        except (OSError, subprocess.SubprocessError, ValueError):
            pass
        max_val = max(distribution) if any(v > 0 for v in distribution) else 0
        norm_dist = [v / max_val if max_val > 0 else 0 for v in distribution]
        return l_id, {"count": count, "distribution": norm_dist}
