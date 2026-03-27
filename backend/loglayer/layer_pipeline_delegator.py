"""
Layer pipeline delegator - Composition-based alternative to LayerPipelineMixin.
"""

import json
import hashlib
import logging
from typing import Dict, Any, Optional, Callable, List
from workers import PipelineWorker, StatsWorker

logger = logging.getLogger(__name__)


class LayerPipelineDelegator:
    """Delegator for layer pipeline operations - composition over inheritance."""

    def __init__(
        self,
        get_session_fn: Callable[[str], Optional[Any]],
        registry,
        rg_path: str,
        retire_worker_fn: Callable[[Any], None],
        signals: Optional[Dict[str, Any]] = None,
    ):
        """
        Args:
            get_session_fn: Function to retrieve session by file_id
            registry: LayerRegistry instance
            rg_path: Path to ripgrep binary
            retire_worker_fn: Function to retire workers
            signals: Dict of signal callbacks (pipelineFinished, operationStarted, etc.)
        """
        self._get_session = get_session_fn
        self._registry = registry
        self._rg_path = rg_path
        self._retire_worker = retire_worker_fn
        self._signals = signals or {}

    def sync_all(self, file_id: str, layers_json: str, search_json: str) -> bool:
        return self.sync_layers(file_id, layers_json, search_json)

    def _merge_system_layers(self, session, new_layers: list) -> list:
        system_layers = [l for l in session.layers if l.get("isSystemManaged")]
        incoming_ids = {l.get("id") for l in new_layers}
        for sl in system_layers:
            if sl.get("id") not in incoming_ids:
                new_layers.append(sl)
        return new_layers

    def sync_layers(self, file_id: str, layers_json: str, search_json: str) -> bool:
        session = self._get_session(file_id)
        if not session:
            return False
        try:
            incoming = json.loads(layers_json)
            session.layers = self._merge_system_layers(session, incoming)
            session.search_config = json.loads(search_json) if search_json else None

            session.layer_instances = []
            session.rendering_instances = []

            for l_conf in session.layers:
                if l_conf.get("enabled"):
                    inst = self._registry.create_layer_instance(l_conf["type"], l_conf["config"])
                    if inst:
                        inst.id = l_conf.get("id")
                        if self._registry.is_rendering_layer(l_conf["type"]):
                            session.rendering_instances.append(inst)
                        else:
                            session.layer_instances.append(inst)

            self._start_pipeline(file_id, session.layer_instances)
            return True
        except Exception as e:
            logger.error(f"Sync layers error: {file_id}: {e}")
            self._emit_signal("operationError", file_id, "sync", str(e))
            self._emit_signal("operationStatusChanged", file_id, "ready", 100)
            return False

    def _emit_signal(self, name: str, *args):
        if name in self._signals:
            self._signals[name](*args)

    def sync_decorations(self, file_id: str, layers_json: str) -> bool:
        session = self._get_session(file_id)
        if not session:
            return False
        try:
            incoming = json.loads(layers_json)
            session.layers = self._merge_system_layers(session, incoming)

            session.rendering_instances = []
            for l_conf in session.layers:
                if l_conf.get("enabled") and self._registry.is_rendering_layer(l_conf["type"]):
                    inst = self._registry.create_layer_instance(l_conf["type"], l_conf["config"])
                    if inst:
                        inst.id = l_conf.get("id")
                        session.rendering_instances.append(inst)

            session.rendering_cache.clear()
            self._emit_refresh_signal(file_id)
            self._start_stats_worker(file_id)
            return True
        except Exception as e:
            logger.error(f"Sync decorations error: {file_id}: {e}")
            return False

    def _emit_refresh_signal(self, file_id: str):
        session = self._get_session(file_id)
        if not session:
            return
        indices_len = (
            len(session.visible_indices)
            if session.visible_indices is not None
            else len(session.line_offsets)
        )
        matches_len = len(session.search_matches) if session.search_matches is not None else 0
        self._emit_signal("pipelineFinished", file_id, indices_len, matches_len)

    def _compute_stats_config_hash(self, session) -> str:
        config_parts = []
        for inst in session.rendering_instances:
            if hasattr(inst, "query") and inst.query:
                config_parts.append(
                    f"{inst.id}:{inst.query}:"
                    f"{getattr(inst, 'regex', False)}:"
                    f"{getattr(inst, 'caseSensitive', False)}"
                )
        if session.search_config and session.search_config.get("query"):
            config_parts.append(
                f"search:{session.search_config.get('query', '')}:"
                f"{session.search_config.get('regex', False)}:"
                f"{session.search_config.get('caseSensitive', False)}"
            )
        config_str = "|".join(sorted(config_parts))
        return hashlib.md5(config_str.encode()).hexdigest()

    def _start_stats_worker(self, file_id: str, force: bool = False) -> None:
        session = self._get_session(file_id)
        if not session:
            return

        has_query_layers = any(
            hasattr(inst, "query") and inst.query for inst in session.rendering_instances
        )
        has_search = session.search_config and session.search_config.get("query")

        if not has_query_layers and not has_search:
            self._emit_signal("statsFinished", file_id, json.dumps({}))
            return

        new_hash = self._compute_stats_config_hash(session)
        if not force and new_hash == session.stats_config_hash and session.stats_cache:
            logger.info(f"[Stats] Using cached stats for file_id={file_id}")
            self._emit_signal("statsFinished", file_id, json.dumps(session.stats_cache))
            return

        if "stats" in session.workers:
            self._retire_worker(session.workers["stats"])

        all_layers = list(session.layer_instances) + list(session.rendering_instances)
        stat_worker = StatsWorker(
            self._rg_path,
            all_layers,
            session.path,
            len(session.line_offsets),
            session.search_config,
        )
        session.workers["stats"] = stat_worker

        def on_stats_finished(stats: str):
            session = self._get_session(file_id)
            if session:
                session.stats_cache = json.loads(stats) if stats else {}
                session.stats_config_hash = new_hash
            self._emit_signal("statsFinished", file_id, stats)

        stat_worker.finished.connect(on_stats_finished)
        stat_worker.error.connect(lambda e: logger.error(f"[Stats] Error for {file_id}: {e}"))
        stat_worker.start()
        logger.info(f"[Stats] StatsWorker started for file_id={file_id}")

    def _start_pipeline(self, file_id, layer_instances):
        logger.info(
            f"[Pipeline] Starting pipeline for file_id={file_id}, layers={len(layer_instances)}"
        )
        session = self._get_session(file_id)
        if not session:
            return

        if "pipeline" in session.workers:
            existing_worker = session.workers["pipeline"]
            if existing_worker.isRunning():
                existing_layers = existing_worker.layers
                layers_same = self._compare_layer_instances(existing_layers, layer_instances)
                search_same = self._compare_search_config(
                    existing_worker.search, session.search_config
                )

                if layers_same and search_same:
                    logger.info(
                        f"[Pipeline] Skipping duplicate pipeline request for file_id={file_id}"
                    )
                    return
                else:
                    logger.info(
                        f"[Pipeline] Cancelling existing pipeline (config changed) for file_id={file_id}"
                    )
                    self._retire_worker(existing_worker)

        if "stats" in session.workers:
            self._retire_worker(session.workers["stats"])

        if not layer_instances and not (
            session.search_config and session.search_config.get("query")
        ):
            session.visible_indices = None
            session.search_matches = None
            session.processing_cache.clear()
            session.rendering_cache.clear()
            self._emit_signal("pipelineFinished", file_id, len(session.line_offsets), 0)
            self._emit_signal("operationStatusChanged", file_id, "ready", 100)
            self._start_stats_worker(file_id)
        else:
            self._emit_signal("operationStarted", file_id, "pipeline")
            worker = PipelineWorker(
                self._rg_path, session.path, layer_instances, session.search_config
            )
            session.workers["pipeline"] = worker
            worker.finished.connect(
                lambda indices, matches: self._on_pipeline_finished(file_id, indices, matches)
            )
            worker.error.connect(
                lambda e: self._emit_signal("operationError", file_id, "pipeline", e)
            )
            worker.start()
            logger.info(f"[Pipeline] Pipeline worker started for file_id={file_id}")

    def _compare_layer_instances(self, layers1, layers2):
        if len(layers1) != len(layers2):
            return False
        for l1, l2 in zip(layers1, layers2):
            type1 = getattr(l1, "type_id", None) or getattr(l1, "type", None)
            type2 = getattr(l2, "type_id", None) or getattr(l2, "type", None)
            if l1.id != l2.id or type1 != type2:
                return False
            if l1.config != l2.config:
                return False
        return True

    def _compare_search_config(self, s1, s2):
        if s1 is None and s2 is None:
            return True
        if s1 is None or s2 is None:
            return False
        return (
            s1.get("query") == s2.get("query")
            and s1.get("regex") == s2.get("regex")
            and s1.get("caseSensitive") == s2.get("caseSensitive")
        )

    def _on_pipeline_finished(self, file_id, visible_indices, search_matches):
        session = self._get_session(file_id)
        if not session:
            return
        session.visible_indices = visible_indices
        session.search_matches = search_matches
        indices_len = (
            len(visible_indices) if visible_indices is not None else len(session.line_offsets)
        )
        matches_len = len(search_matches) if search_matches is not None else 0
        session.processing_cache.clear()
        session.rendering_cache.clear()
        self._emit_signal("pipelineFinished", file_id, indices_len, matches_len)
        self._emit_signal("operationStatusChanged", file_id, "ready", 100)
        self._start_stats_worker(file_id)


__all__ = ["LayerPipelineDelegator"]
