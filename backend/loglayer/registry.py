import os
import importlib.util
import inspect
from pathlib import Path
from loglayer.core import (
    Layer,
    FilterLayer,
    TransformLayer,
    DecorationLayer,
    LayerCategory,
    LayerStage,
    HighlightLayer,
    Widget,
)
from loglayer.storage import StorageRegistry
from loglayer.schemas import LayerRegistryEntry, LayerUIField


def _discover_layers_from_dir(directory: str, is_builtin: bool = False) -> tuple:
    """Discover layers and widgets from a directory."""
    layers = {}
    widgets = {}

    if not directory or not os.path.exists(directory):
        return layers, widgets

    for filename in os.listdir(directory):
        if filename.endswith(".py") and not filename.startswith("_"):
            path = os.path.join(directory, filename)
            name = filename[:-3]
            try:
                spec = importlib.util.spec_from_file_location(name, path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if inspect.isclass(attr):
                        # Skip imported base classes from loglayer.core and loglayer.ui
                        if attr.__module__ in ("loglayer.core", "loglayer.ui", "typing"):
                            continue

                        # 1. 发现图层 (FilterLayer, TransformLayer, RenderingLayer, DecorationLayer)
                        # Include classes that inherit from layer base classes but are NOT the base classes themselves
                        is_filter = (
                            issubclass(attr, FilterLayer)
                            and attr is not FilterLayer
                            and attr is not Layer
                        )
                        is_transform = (
                            issubclass(attr, TransformLayer)
                            and attr is not TransformLayer
                            and attr is not Layer
                        )
                        is_rendering = (
                            issubclass(attr, HighlightLayer)
                            and attr is not HighlightLayer
                            and attr is not Layer
                        )
                        is_decoration = (
                            issubclass(attr, DecorationLayer)
                            and attr is not DecorationLayer
                            and attr is not Layer
                        )
                        if is_filter or is_transform or is_rendering or is_decoration:
                            # Get type_id from class attribute (preferred) or generate
                            type_id = getattr(attr, "type_id", None)
                            if not type_id:
                                # Fallback: generate from class name
                                type_id = (
                                    f"PYTHON_{name.upper()}_{attr_name.upper()}"
                                    if not is_builtin
                                    else attr.__name__.upper()
                                )
                            if type_id:
                                layers[type_id] = (attr, is_builtin)

                        # 2. 发现 UI 挂件
                        elif issubclass(attr, Widget) and attr is not Widget:
                            widget_type = (
                                f"BUILTIN_{attr_name.upper()}"
                                if is_builtin
                                else f"WIDGET_{name.upper()}_{attr_name.upper()}"
                            )
                            widgets[widget_type] = (attr, is_builtin)

            except Exception:
                pass

    return layers, widgets


class LayerRegistry:
    """
    图层与插件注册表。
    自动发现所有图层和 UI 挂件。

    目录结构:
    - layers/builtin/  # 内置图层
    - layers/user/      # 用户自定义图层
    """

    def __init__(self, plugin_dir=None):
        self.builtin_layers = {}  # type_id -> (class, is_builtin)
        self.plugin_layers = {}  # type_id -> (class, is_builtin)
        self.plugin_widgets = {}  # type_id -> (class, is_builtin)
        self.plugin_dir = plugin_dir
        self.storage = StorageRegistry()

        # 自动发现内置图层 (layers/builtin/)
        builtin_dir = Path(__file__).parent / "layers" / "builtin"
        builtin_layers, builtin_widgets = _discover_layers_from_dir(
            str(builtin_dir), is_builtin=True
        )
        self.builtin_layers.update(builtin_layers)
        self.plugin_widgets.update(builtin_widgets)

    def discover_plugins(self):
        """扫描插件目录，加载图层和 UI 挂件"""
        if not self.plugin_dir or not os.path.exists(self.plugin_dir):
            return

        self.plugin_layers.clear()
        self.plugin_widgets.clear()

        # 扫描插件目录
        plugin_layers, plugin_widgets = _discover_layers_from_dir(self.plugin_dir, is_builtin=False)
        self.plugin_layers.update(plugin_layers)
        self.plugin_widgets.update(plugin_widgets)

    def _get_layer_info(self, tid, cls, is_builtin):
        """生成单个图层的元信息"""
        return LayerRegistryEntry(
            type=tid,
            display_name=cls.display_name,
            description=cls.description,
            icon=getattr(cls, "icon", "default"),
            ui_schema=cls.get_ui_schema(),
            is_builtin=is_builtin,
            category=getattr(cls, "category", LayerCategory.FILTER),
            stage=getattr(cls, "stage", LayerStage.LOGIC),
        )

    def get_all_types(self):
        """返回所有可用图层类型"""
        results = []
        for tid, (cls, is_builtin) in self.builtin_layers.items():
            entry = self._get_layer_info(tid, cls, is_builtin)
            results.append(entry.model_dump())
        for tid, (cls, is_builtin) in self.plugin_layers.items():
            entry = self._get_layer_info(tid, cls, is_builtin)
            results.append(entry.model_dump())
        return results

    def get_types_by_category(self):
        """按类别分组返回图层类型"""
        all_types = self.get_all_types()
        return {
            "filter": [t for t in all_types if t.get("category") == LayerCategory.FILTER],
            "transform": [t for t in all_types if t.get("category") == LayerCategory.TRANSFORM],
            "highlight": [t for t in all_types if t.get("category") == LayerCategory.HIGHLIGHT],
            "decoration": [t for t in all_types if t.get("category") == LayerCategory.DECORATION],
            "widget": [t for t in all_types if t.get("category") == LayerCategory.WIDGET],
        }

    def create_layer_instance(self, type_id, config):
        """根据类型 ID 创建图层实例"""
        entry = self.builtin_layers.get(type_id) or self.plugin_layers.get(type_id)
        if not entry:
            return None
        cls = entry[0] if isinstance(entry, tuple) else entry
        return cls(config)

    def is_rendering_layer(self, type_id):
        entry = self.builtin_layers.get(type_id) or self.plugin_layers.get(type_id)
        if not entry:
            return False
        cls = entry[0] if isinstance(entry, tuple) else entry
        return getattr(cls, "category", None) in [LayerCategory.HIGHLIGHT, LayerCategory.DECORATION]

    def get_ui_widgets(self):
        """返回所有可用挂件的元信息"""
        results = []
        for tid, (cls, is_builtin) in self.plugin_widgets.items():
            results.append(
                {
                    "type": tid,
                    "display_name": cls.display_name,
                    "role": getattr(cls, "role", "statusbar"),
                    "refresh_interval": getattr(cls, "refresh_interval", 0),
                }
            )
        return results

    def create_widget_instance(self, type_id):
        entry = self.plugin_widgets.get(type_id)
        if not entry:
            return None
        cls = entry[0] if isinstance(entry, tuple) else entry
        return cls()
