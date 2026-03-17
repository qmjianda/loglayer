import json
import logging
from workers import PipelineWorker, StatsWorker

logger = logging.getLogger(__name__)


class LayerPipelineMixin:
    """
    Mixin for layer synchronization and pipeline management.
    
    Expected host class attributes:
    - self._sessions: Dict of file sessions
    - self._registry: LayerRegistry instance
    - self._rg_path: Path to ripgrep binary
    - self._retire_worker: Method to retire workers
    
    Expected host class signals:
    - pipelineFinished: Signal(str, int, int)
    - operationStarted: Signal(str, str)
    - operationProgress: Signal(str, str, float)
    - operationError: Signal(str, str, str)
    - operationStatusChanged: Signal(str, str, int)
    - statsFinished: Signal(str, str)
    """

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
        if file_id not in self._sessions:
            return False
        session = self._sessions[file_id]
        try:
            incoming = json.loads(layers_json)
            session.layers = self._merge_system_layers(session, incoming)
            session.search_config = json.loads(search_json) if search_json else None

            session.layer_instances = []
            session.rendering_instances = []

            for l_conf in session.layers:
                if l_conf.get("enabled"):
                    inst = self._registry.create_layer_instance(
                        l_conf["type"], l_conf["config"]
                    )
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
            self.operationError.emit(file_id, "sync", str(e))
            self.operationStatusChanged.emit(file_id, "ready", 100)
            return False

    def _emit_refresh_signal(self, file_id: str):
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
        if file_id not in self._sessions:
            return False
        session = self._sessions[file_id]
        try:
            incoming = json.loads(layers_json)
            session.layers = self._merge_system_layers(session, incoming)

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

            session.rendering_cache.clear()
            self._emit_refresh_signal(file_id)

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
            logger.error(f"Sync decorations error: {file_id}: {e}")
            return False

    def _start_pipeline(self, file_id, layer_instances):
        logger.info(f"[Pipeline] Starting pipeline for file_id={file_id}, layers={len(layer_instances)}")
        if file_id not in self._sessions:
            return
        session = self._sessions[file_id]
        
        if "pipeline" in session.workers:
            existing_worker = session.workers["pipeline"]
            if existing_worker.isRunning():
                existing_layers = existing_worker.layers
                layers_same = self._compare_layer_instances(existing_layers, layer_instances)
                search_same = self._compare_search_config(existing_worker.search, session.search_config)
                
                if layers_same and search_same:
                    logger.info(f"[Pipeline] Skipping duplicate pipeline request for file_id={file_id}")
                    return
                else:
                    logger.info(f"[Pipeline] Cancelling existing pipeline (config changed) for file_id={file_id}")
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
            self.pipelineFinished.emit(file_id, len(session.line_offsets), 0)
            self.operationStatusChanged.emit(file_id, "ready", 100)
        else:
            self.operationStarted.emit(file_id, "pipeline")
            worker = PipelineWorker(
                self._rg_path, session.path, layer_instances, session.search_config
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
            worker.start()
            logger.info(f"[Pipeline] Pipeline worker started for file_id={file_id}")
        if any(
            l.get("enabled") and l.get("type") in ["HIGHLIGHT", "FILTER", "LEVEL"]
            for l in session.layers
        ) or (session.search_config and session.search_config.get("query")):
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

    def _compare_layer_instances(self, layers1, layers2):
        if len(layers1) != len(layers2):
            return False
        for l1, l2 in zip(layers1, layers2):
            type1 = getattr(l1, 'type_id', None) or getattr(l1, 'type', None)
            type2 = getattr(l2, 'type_id', None) or getattr(l2, 'type', None)
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
        return s1.get("query") == s2.get("query") and s1.get("regex") == s2.get("regex") and s1.get("caseSensitive") == s2.get("caseSensitive")

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
        self.pipelineFinished.emit(file_id, indices_len, matches_len)
        self.operationStatusChanged.emit(file_id, "ready", 100)