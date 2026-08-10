"""LogSession：单个文件的会话状态（索引、缓存、图层、Worker 管理）。"""

import array
from typing import Optional

from .cache import LRUCache


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
