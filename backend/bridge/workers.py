"""线程基类与后台 Worker：索引、管线、统计。"""

import array
import json
import os
import re
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from loglayer.core import LayerStage, ProcessedLine

from .signal import Signal
from .utils import get_creationflags
from .search_matching import compute_search_matches

# Constants
PROCESS_CLEANUP_TIMEOUT = 0.3  # Seconds to wait for process termination before killing


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
