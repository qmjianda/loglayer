import os
import importlib.util
import inspect
from loglayer.core import (
    Layer, FilterLayer, TransformLayer, HighlightLayer, DecorationLayer, 
    Widget, LayerCategory, LayerStage, RenderingLayer, UIWidget
)
from loglayer.storage import StorageRegistry

class LayerRegistry:
    """
    图层与插件注册表。
    管理所有内置图层、动态加载的插件图层以及 UI 挂件。
    """
    def __init__(self, plugin_dir=None):
        self.builtin_layers = {}  # type_id -> class
        self.plugin_layers = {}   # type_id -> class
        self.plugin_widgets = {}  # type_id -> class
        self.plugin_dir = plugin_dir
        self.storage = StorageRegistry()
        
        # 加载内置图层 - 处理层
        from loglayer.builtin.filter import FilterLayer
        from loglayer.builtin.level import LevelLayer
        from loglayer.builtin.replace import ReplaceLayer
        from loglayer.builtin.range import RangeLayer
        from loglayer.builtin.time import TimeLayer
        from loglayer.builtin.time_range import TimeRangeFilterLayer, RelativeTimeFilterLayer
        from loglayer.builtin.query import QueryLayer
        from loglayer.builtin.label import LabelLayer
        
        # 加载内置图层 - 渲染层
        from loglayer.builtin.highlight import HighlightLayer
        from loglayer.builtin.rowtint import RowTintLayer
        
        # 注册处理层
        self.register_builtin("FILTER", FilterLayer)
        self.register_builtin("LEVEL", LevelLayer)
        self.register_builtin("TRANSFORM", ReplaceLayer)
        self.register_builtin("RANGE", RangeLayer)
        self.register_builtin("TIME_RANGE", TimeLayer)
        self.register_builtin("TIME_RANGE_FILTER", TimeRangeFilterLayer)
        self.register_builtin("RELATIVE_TIME_FILTER", RelativeTimeFilterLayer)
        self.register_builtin("QUERY", QueryLayer)
        self.register_builtin("LABEL", LabelLayer)
        
        # 注册渲染层
        self.register_builtin("HIGHLIGHT", HighlightLayer)
        self.register_builtin("ROWTINT", RowTintLayer)

    def register_builtin(self, type_id, cls):
        self.builtin_layers[type_id] = cls

    def discover_plugins(self):
        """扫描插件目录，加载图层和 UI 挂件"""
        if not self.plugin_dir or not os.path.exists(self.plugin_dir):
            return
        
        self.plugin_layers.clear()
        self.plugin_widgets.clear()
        
        for filename in os.listdir(self.plugin_dir):
            if filename.endswith(".py") and not filename.startswith("_"):
                path = os.path.join(self.plugin_dir, filename)
                name = filename[:-3]
                try:
                    spec = importlib.util.spec_from_file_location(name, path)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    
                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if inspect.isclass(attr):
                            # 1. 发现图层 (FilterLayer 或 TransformLayer)
                            is_filter = issubclass(attr, FilterLayer) and attr is not FilterLayer
                            is_transform = issubclass(attr, TransformLayer) and attr is not TransformLayer
                            is_rendering = issubclass(attr, RenderingLayer) and attr is not RenderingLayer
                            if is_filter or is_transform or is_rendering:
                                plugin_type = f"PYTHON_{name}_{attr_name}".upper()
                                self.plugin_layers[plugin_type] = attr
                                print(f"[Registry] Found layer plugin: {plugin_type}")
                            
                            # 2. 发现 UI 挂件
                            elif issubclass(attr, UIWidget) and attr is not UIWidget:
                                widget_type = f"WIDGET_{name}_{attr_name}".upper()
                                self.plugin_widgets[widget_type] = attr
                                print(f"[Registry] Found UI widget: {widget_type}")
                                
                except Exception as e:
                    print(f"[Registry] Error loading plugin {filename}: {e}")

    def _get_layer_info(self, tid, cls, is_builtin):
        """生成单个图层的元信息"""
        return {
            "type": tid,
            "display_name": cls.display_name,
            "description": cls.description,
            "icon": getattr(cls, "icon", "default"),
            "category": getattr(cls, "category", LayerCategory.FILTER),
            "stage": getattr(cls, "stage", LayerStage.LOGIC),
            "ui_schema": cls.get_ui_schema(),
            "is_builtin": is_builtin
        }

    def get_all_types(self):
        """返回所有可用图层类型"""
        results = []
        for tid, cls in self.builtin_layers.items():
            results.append(self._get_layer_info(tid, cls, True))
        for tid, cls in self.plugin_layers.items():
            results.append(self._get_layer_info(tid, cls, False))
        return results

    def get_types_by_category(self):
        """按类别分组返回图层类型"""
        all_types = self.get_all_types()
        return {
            "filter": [t for t in all_types if t["category"] == LayerCategory.FILTER],
            "transform": [t for t in all_types if t["category"] == LayerCategory.TRANSFORM],
            "highlight": [t for t in all_types if t["category"] == LayerCategory.HIGHLIGHT],
            "decoration": [t for t in all_types if t["category"] == LayerCategory.DECORATION],
            "widget": [t for t in all_types if t["category"] == LayerCategory.WIDGET],
        }

    def create_layer_instance(self, type_id, config):
        """根据类型 ID 创建图层实例"""
        cls = self.builtin_layers.get(type_id) or self.plugin_layers.get(type_id)
        if not cls: return None
        return cls(config)
    
    def is_rendering_layer(self, type_id):
        cls = self.builtin_layers.get(type_id) or self.plugin_layers.get(type_id)
        if not cls: return False
        return getattr(cls, "category", None) in [
            LayerCategory.HIGHLIGHT, 
            LayerCategory.DECORATION
        ]

    def get_ui_widgets(self):
        """返回所有可用挂件的元信息"""
        results = []
        for tid, cls in self.plugin_widgets.items():
            results.append({
                "type": tid,
                "display_name": cls.display_name,
                "role": getattr(cls, "role", "statusbar"),
                "refresh_interval": getattr(cls, "refresh_interval", 0)
            })
        return results

    def create_widget_instance(self, type_id):
        cls = self.plugin_widgets.get(type_id)
        if not cls: return None
        return cls()
