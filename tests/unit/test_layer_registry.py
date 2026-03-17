import pytest
import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from loglayer.registry import LayerRegistry
from loglayer.core import LayerCategory, LayerStage


class TestLayerRegistry:
    """Test LayerRegistry"""
    
    def test_registry_init(self):
        registry = LayerRegistry()
        assert registry.builtin_layers is not None
        assert registry.plugin_layers is not None
        assert registry.plugin_widgets is not None
    
    def test_builtin_layers_registered(self):
        registry = LayerRegistry()
        assert "FILTER" in registry.builtin_layers
        assert "LEVEL" in registry.builtin_layers
        assert "HIGHLIGHT" in registry.builtin_layers
        assert "QUERY" in registry.builtin_layers
        assert "LABEL" in registry.builtin_layers
    
    def test_get_all_types(self):
        registry = LayerRegistry()
        types = registry.get_all_types()
        assert isinstance(types, list)
        assert len(types) > 0
    
    def test_get_all_types_has_required_fields(self):
        registry = LayerRegistry()
        types = registry.get_all_types()
        for t in types:
            assert "type" in t
            assert "display_name" in t
            assert "description" in t
            assert "icon" in t
            assert "category" in t
            assert "stage" in t
            assert "ui_schema" in t
            assert "is_builtin" in t
    
    def test_get_types_by_category(self):
        registry = LayerRegistry()
        by_cat = registry.get_types_by_category()
        assert "filter" in by_cat
        assert "transform" in by_cat
        assert "highlight" in by_cat
        assert "decoration" in by_cat
    
    def test_create_layer_instance(self):
        registry = LayerRegistry()
        instance = registry.create_layer_instance("FILTER", {"query": "test"})
        assert instance is not None
    
    def test_create_layer_instance_unknown_type(self):
        registry = LayerRegistry()
        instance = registry.create_layer_instance("UNKNOWN_TYPE", {})
        assert instance is None
    
    def test_is_rendering_layer_highlight(self):
        registry = LayerRegistry()
        assert registry.is_rendering_layer("HIGHLIGHT") is True
    
    def test_is_rendering_layer_filter(self):
        registry = LayerRegistry()
        assert registry.is_rendering_layer("FILTER") is False
    
    def test_is_rendering_layer_unknown(self):
        registry = LayerRegistry()
        assert registry.is_rendering_layer("UNKNOWN") is False


class TestBuiltinLayers:
    """Test built-in layer classes"""
    
    def test_filter_layer_class(self):
        registry = LayerRegistry()
        entry = registry.builtin_layers["FILTER"]
        cls = entry[0] if isinstance(entry, tuple) else entry
        layer = cls({"query": "error", "regex": True, "caseSensitive": True})
        args = layer.get_rg_args()
        assert "-e" in args
        assert "error" in args
    
    def test_level_layer_class(self):
        registry = LayerRegistry()
        entry = registry.builtin_layers["LEVEL"]
        cls = entry[0] if isinstance(entry, tuple) else entry
        layer = cls({"levels": ["ERROR", "WARN"]})
        args = layer.get_rg_args()
        assert "-i" in args
        assert "-e" in args
    
    def test_query_layer_class(self):
        registry = LayerRegistry()
        entry = registry.builtin_layers["QUERY"]
        cls = entry[0] if isinstance(entry, tuple) else entry
        layer = cls()
        layer.query = "level:ERROR"
        assert layer.filter_line("2026-01-01 ERROR something failed") is True
        assert layer.filter_line("2026-01-01 INFO normal") is False
    
    def test_highlight_layer_class(self):
        registry = LayerRegistry()
        entry = registry.builtin_layers["HIGHLIGHT"]
        cls = entry[0] if isinstance(entry, tuple) else entry
        layer = cls({"query": "error", "color": "#ff0000"})
        highlights = layer.highlight_line("error occurred")
        assert len(highlights) > 0
        assert highlights[0]["start"] == 0
        assert highlights[0]["end"] == 5