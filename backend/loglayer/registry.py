from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from loglayer.core import LayerCategory, LayerStage, derive_engine
from loglayer.storage import StorageRegistry

from .plugin_contract import CapabilityDeclaration, PluginManifest


class RegistryRegistrationError(ValueError):
    def __init__(self, message: str, code: str) -> None:
        super().__init__(message)
        self.code = code


BUILTIN_PLUGIN_ID = "builtin"

_CATEGORY_TO_TYPE = {
    LayerCategory.FILTERING: "FILTER",
    LayerCategory.TRANSFORM: "TRANSFORM",
    LayerCategory.RENDERING: "RENDERING",
}


@dataclass(frozen=True)
class CapabilityRecord:
    capability_id: str
    plugin_id: str
    capability_type: str
    version: str
    display_name: str
    description: str
    icon: str
    category: str
    stage: str
    derived_engine: str
    ui_schema: Any = None
    factory: Any = None
    renderer_id: str | None = None


@dataclass(frozen=True)
class WidgetMetadata:
    capability_id: str
    plugin_id: str
    display_name: str
    description: str
    slot: str
    renderer_id: str
    config: Any = None
    refresh_interval: float = 0
    data_provider: Any = None


class PluginStaging:
    def __init__(self, manifest: PluginManifest) -> None:
        self.manifest = manifest
        self._layers: list[CapabilityRecord] = []
        self._widgets: list[WidgetMetadata] = []

    def _declaration(self, capability_id: str) -> CapabilityDeclaration:
        for declaration in self.manifest.capabilities:
            if declaration.id == capability_id:
                return declaration
        raise RegistryRegistrationError(f"undeclared capability: {capability_id}", "undeclared_capability")

    def register_layer(self, capability_id: str, category: str, stage: str, factory: Any, **metadata: Any) -> None:
        normalized = {
            LayerCategory.FILTERING: LayerCategory.FILTERING,
            "FILTER": LayerCategory.FILTERING,
            LayerCategory.TRANSFORM: LayerCategory.TRANSFORM,
            "TRANSFORM": LayerCategory.TRANSFORM,
            LayerCategory.RENDERING: LayerCategory.RENDERING,
            "RENDERING": LayerCategory.RENDERING,
        }.get(category)
        if normalized is None:
            return
        declaration = self._declaration(capability_id)
        if declaration.type not in ("FILTER", "TRANSFORM", "RENDERING"):
            raise RegistryRegistrationError(f"{capability_id} is not a layer", "invalid_capability_type")
        self._layers.append(
            CapabilityRecord(
                capability_id=f"{self.manifest.id}:{capability_id}",
                plugin_id=self.manifest.id,
                capability_type=declaration.type,
                version=declaration.version,
                display_name=metadata.get("display_name", declaration.display_name),
                description=metadata.get("description", declaration.description),
                icon=metadata.get("icon", declaration.icon),
                category=normalized,
                stage=stage,
                derived_engine=derive_engine(normalized, stage),
                ui_schema=metadata.get("ui_schema", declaration.ui_schema),
                factory=None if normalized == LayerCategory.RENDERING else factory,
                renderer_id=declaration.renderer_id,
            )
        )

    def register_widget(
        self,
        capability_id: str,
        slot: str | None = None,
        renderer_id: str | None = None,
        config: Any = None,
        data_provider: Any = None,
        **metadata: Any,
    ) -> None:
        declaration = self._declaration(capability_id)
        if declaration.type != "UIWidget":
            raise RegistryRegistrationError(f"{capability_id} is not a widget", "invalid_capability_type")
        self._widgets.append(
            WidgetMetadata(
                capability_id=f"{self.manifest.id}:{capability_id}",
                plugin_id=self.manifest.id,
                display_name=metadata.get("display_name", declaration.display_name),
                description=metadata.get("description", declaration.description),
                slot=slot or declaration.slot or "",
                renderer_id=renderer_id or declaration.renderer_id or "",
                config=config,
                refresh_interval=metadata.get("refresh_interval", 0),
                data_provider=data_provider,
            )
        )


class RegistryFacade:
    """统一注册门面：内置图层与插件能力共用同一记录模型。"""

    def __init__(self, plugin_dir: str | os.PathLike[str] | None = None) -> None:
        self.plugin_dir = plugin_dir
        self.storage = StorageRegistry()
        self._records: dict[str, CapabilityRecord] = {}
        self._widgets: dict[str, WidgetMetadata] = {}
        self._local_capability_ids: set[str] = set()
        self._external_module_names: set[str] = set()
        self._external_plugin_ids: set[str] = set()
        self.plugin_diagnostics: list[Any] = []
        self._register_builtins()

    def _register_builtins(self) -> None:
        from loglayer.builtin.bookmark import BookmarkLayer
        from loglayer.builtin.filter import FilterLayer
        from loglayer.builtin.highlight import HighlightLayer
        from loglayer.builtin.level import LevelLayer
        from loglayer.builtin.range import RangeLayer
        from loglayer.builtin.replace import ReplaceLayer
        from loglayer.builtin.rowtint import RowTintLayer
        from loglayer.builtin.time import TimeLayer
        from loglayer.builtin.time_range import RelativeTimeFilterLayer, TimeRangeFilterLayer

        for type_id, layer in {
            "FILTER": FilterLayer,
            "LEVEL": LevelLayer,
            "TRANSFORM": ReplaceLayer,
            "RANGE": RangeLayer,
            "TIME_RANGE": TimeLayer,
            "TIME_RANGE_FILTER": TimeRangeFilterLayer,
            "RELATIVE_TIME_FILTER": RelativeTimeFilterLayer,
            "HIGHLIGHT": HighlightLayer,
            "ROWTINT": RowTintLayer,
            "BOOKMARK": BookmarkLayer,
        }.items():
            self.register_builtin(type_id, layer)

    def register_builtin(self, type_id: str, cls: type) -> None:
        category = getattr(cls, "category", LayerCategory.FILTERING)
        stage = getattr(cls, "stage", LayerStage.LOGIC)
        self._records[type_id] = CapabilityRecord(
            capability_id=type_id,
            plugin_id=BUILTIN_PLUGIN_ID,
            capability_type=_CATEGORY_TO_TYPE.get(category, "FILTER"),
            version="1.0.0",
            display_name=getattr(cls, "display_name", type_id),
            description=getattr(cls, "description", ""),
            icon=getattr(cls, "icon", "default"),
            category=category,
            stage=stage,
            derived_engine=derive_engine(category, stage),
            ui_schema=cls.get_ui_schema(),
            factory=cls,
        )
        self._local_capability_ids.add(type_id)

    def begin_plugin(self, manifest: PluginManifest) -> PluginStaging:
        return PluginStaging(manifest)

    def commit(self, staging: PluginStaging) -> None:
        layer_ids = [record.capability_id for record in staging._layers]
        widget_ids = [record.capability_id for record in staging._widgets]
        if len(layer_ids) != len(set(layer_ids)) or len(widget_ids) != len(set(widget_ids)):
            raise RegistryRegistrationError("duplicate capability id", "duplicate_capability_id")
        if set(layer_ids) & set(self._records) or set(widget_ids) & set(self._records):
            raise RegistryRegistrationError("duplicate capability id", "duplicate_capability_id")
        if set(widget_ids) & set(self._widgets):
            raise RegistryRegistrationError("duplicate capability id", "duplicate_capability_id")
        local_ids = {record.capability_id.rsplit(":", 1)[-1] for record in staging._layers}
        local_ids |= {record.capability_id.rsplit(":", 1)[-1] for record in staging._widgets}
        if local_ids & self._local_capability_ids:
            raise RegistryRegistrationError("duplicate capability id", "duplicate_capability_id")
        for record in staging._layers:
            self._records[record.capability_id] = record
        for widget in staging._widgets:
            self._widgets[widget.capability_id] = widget
        self._local_capability_ids.update(local_ids)

    def layers(self) -> list[CapabilityRecord]:
        return list(self._records.values())

    def widgets(self) -> list[WidgetMetadata]:
        return list(self._widgets.values())

    def discover_plugins(self) -> None:
        from .plugin_discovery import PluginDiscovery
        from .plugin_hooks import PluginManager
        from .plugin_loader import PluginLoader

        self._clear_external_plugins()
        configured = (self.plugin_dir,) if self.plugin_dir else ()
        discovery = PluginDiscovery(configured_directories=configured)
        result = discovery.discover()
        self.plugin_diagnostics = [*result.diagnostics, *result.failures]
        manager = PluginManager()
        loader = PluginLoader()
        for candidate in result.selected:
            if candidate.manifest is None:
                continue
            try:
                loaded = loader.load_external(candidate.manifest, candidate.source) if candidate.plugin is None else None
                plugin = candidate.plugin if candidate.plugin is not None else loaded.plugin
                if loaded is not None:
                    self._external_module_names.add(loaded.module_name)
                outcome = manager.register(plugin, candidate.manifest, self)
                if outcome.diagnostic is not None:
                    self.plugin_diagnostics.append(outcome.diagnostic)
                if outcome.state == "registered":
                    self._external_plugin_ids.add(candidate.plugin_id)
            except Exception as error:
                self.plugin_diagnostics.append({"plugin_id": candidate.plugin_id, "stage": "load", "code": "entry_load_failed", "message": str(error)})

    def _clear_external_plugins(self) -> None:
        for module_name in self._external_module_names:
            sys.modules.pop(module_name, None)
        self._external_module_names.clear()
        self._external_plugin_ids.clear()
        external_layer_ids = [cid for cid, record in self._records.items() if record.plugin_id != BUILTIN_PLUGIN_ID]
        for capability_id in external_layer_ids:
            del self._records[capability_id]
        self._widgets.clear()
        self._local_capability_ids -= {cid for cid in self._local_capability_ids if ":" in cid}

    def reload_plugins(self) -> bool:
        self.discover_plugins()
        return True

    def get_all_types(self) -> list[dict[str, Any]]:
        results = []
        for record in self._records.values():
            item: dict[str, Any] = {
                "type": record.capability_id,
                "display_name": record.display_name,
                "description": record.description,
                "icon": record.icon,
                "category": record.category,
                "engine": record.derived_engine,
                "ui_schema": record.ui_schema,
                "is_builtin": record.plugin_id == BUILTIN_PLUGIN_ID,
            }
            if record.renderer_id:
                item["renderer_id"] = record.renderer_id
            results.append(item)
        return results

    def get_types_by_category(self) -> dict[str, list[dict[str, Any]]]:
        all_types = self.get_all_types()
        return {
            "processing": [item for item in all_types if item["category"] != LayerCategory.RENDERING],
            "rendering": [item for item in all_types if item["category"] == LayerCategory.RENDERING],
        }

    def create_layer_instance(self, type_id: str, config: Any) -> Any:
        record = self._records.get(type_id)
        if record is None or record.factory is None:
            return None
        instance = record.factory(config)
        # 管线按 stage/category 分流；插件实例从记录注入，作者无需重复声明
        if not hasattr(instance, "stage"):
            instance.stage = record.stage
        if not hasattr(instance, "category"):
            instance.category = record.category
        return instance

    def is_rendering_layer(self, type_id: str) -> bool:
        record = self._records.get(type_id)
        return record is not None and (
            record.category == LayerCategory.RENDERING or record.capability_type == "RENDERING"
        )

    def get_ui_widgets(self) -> list[dict[str, Any]]:
        return [
            {
                "type": widget.capability_id,
                "id": widget.capability_id,
                "plugin_id": widget.plugin_id,
                "display_name": widget.display_name,
                "description": widget.description,
                "slot": widget.slot,
                "renderer_id": widget.renderer_id,
                "config": widget.config,
                "role": widget.slot,
                "refresh_interval": widget.refresh_interval,
            }
            for widget in self._widgets.values()
        ]

    def get_widget_data(self, type_id: str) -> dict[str, Any]:
        widget = self._widgets.get(type_id)
        if widget is None or widget.data_provider is None:
            return {}
        try:
            return widget.data_provider() or {}
        except Exception as e:
            print(f"[Registry] Error: widget data provider failed for {type_id}: {e}")
            return {}


LayerRegistry = RegistryFacade
