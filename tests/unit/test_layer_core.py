import pytest
import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from loglayer.core import (
    Layer, FilterLayer, TransformLayer, HighlightLayer, DecorationLayer, Widget,
    LayerCategory, LayerStage, Highlight, RowStyle, LayerResult, PipelineContext
)


class TestLayerStage:
    """Test LayerStage enum"""
    
    def test_stage_values(self):
        assert LayerStage.NATIVE == "native"
        assert LayerStage.LOGIC == "logic"
        assert LayerStage.RENDERING == "rendering"
    
    def test_stage_order(self):
        assert LayerStage.NATIVE.value == "native"
        assert LayerStage.LOGIC.value == "logic"
        assert LayerStage.RENDERING.value == "rendering"


class TestLayerCategory:
    """Test LayerCategory enum"""
    
    def test_category_values(self):
        assert LayerCategory.FILTER == "filter"
        assert LayerCategory.TRANSFORM == "transform"
        assert LayerCategory.HIGHLIGHT == "highlight"
        assert LayerCategory.DECORATION == "decoration"
        assert LayerCategory.WIDGET == "widget"


class TestDataClasses:
    """Test data classes"""
    
    def test_highlight_creation(self):
        h = Highlight(start=0, end=5, color="#ff0000", opacity=100.0)
        assert h.start == 0
        assert h.end == 5
        assert h.color == "#ff0000"
        assert h.opacity == 100.0
    
    def test_highlight_defaults(self):
        h = Highlight(start=0, end=5)
        assert h.color == "#3b82f6"
        assert h.opacity == 100.0
    
    def test_row_style_creation(self):
        rs = RowStyle(background_color="#1e1e1e", color="#ffffff")
        assert rs.background_color == "#1e1e1e"
        assert rs.color == "#ffffff"
        assert rs.font_weight is None
    
    def test_row_style_defaults(self):
        rs = RowStyle()
        assert rs.background_color is None
        assert rs.color is None
        assert rs.font_weight is None


class TestFilterLayer:
    """Test FilterLayer base class"""
    
    def test_filter_layer_defaults(self):
        layer = FilterLayer()
        assert layer.category == LayerCategory.FILTER
        assert layer.stage == LayerStage.LOGIC
        assert layer.icon == "filter"
    
    def test_filter_line_default(self):
        layer = FilterLayer()
        assert layer.filter_line("any content") is True
        assert layer.filter_line("", 0) is True
    
    def test_filter_layer_process(self):
        layer = FilterLayer()
        ctx = PipelineContext(
            file_path="/test/log.txt",
            line_offsets=[0, 100, 200],
            visible_indices=[0, 1, 2],
            line_count=3
        )
        result = layer.process(ctx)
        assert result.success is True
        assert result.indices == [0, 1, 2]


class TestNativeFilterLayer:
    """Test NativeFilterLayer"""
    
    def test_native_filter_stage(self):
        from loglayer.core import NativeFilterLayer
        layer = NativeFilterLayer()
        assert layer.stage == LayerStage.NATIVE


class TestTransformLayer:
    """Test TransformLayer"""
    
    def test_transform_layer_defaults(self):
        layer = TransformLayer()
        assert layer.category == LayerCategory.TRANSFORM
        assert layer.stage == LayerStage.LOGIC
        assert layer.icon == "replace"
    
    def test_transform_line_default(self):
        layer = TransformLayer()
        assert layer.transform_line("original") == "original"
    
    def test_transform_layer_process(self):
        layer = TransformLayer()
        ctx = PipelineContext(
            file_path="/test/log.txt",
            line_offsets=[0, 100],
            visible_indices=[0, 1],
            line_count=2
        )
        result = layer.process(ctx)
        assert result.success is True
        assert result.transformed_lines == {}


class TestHighlightLayer:
    """Test HighlightLayer"""
    
    def test_highlight_layer_defaults(self):
        layer = HighlightLayer()
        assert layer.category == LayerCategory.HIGHLIGHT
        assert layer.stage == LayerStage.RENDERING
        assert layer.icon == "highlight"
    
    def test_get_highlights_default(self):
        layer = HighlightLayer()
        assert layer.get_highlights("any content") == []
    
    def test_highlight_layer_process(self):
        layer = HighlightLayer()
        ctx = PipelineContext(
            file_path="/test/log.txt",
            line_offsets=[0, 100],
            visible_indices=[0, 1],
            line_count=2
        )
        result = layer.process(ctx)
        assert result.success is True
        assert result.highlights == []


class TestDecorationLayer:
    """Test DecorationLayer"""
    
    def test_decoration_layer_defaults(self):
        layer = DecorationLayer()
        assert layer.category == LayerCategory.DECORATION
        assert layer.stage == LayerStage.RENDERING
        assert layer.icon == "palette"
    
    def test_get_row_style_default(self):
        layer = DecorationLayer()
        style = layer.get_row_style("content")
        assert style.background_color is None
        assert style.color is None
    
    def test_decoration_layer_process(self):
        layer = DecorationLayer()
        ctx = PipelineContext(
            file_path="/test/log.txt",
            line_offsets=[0, 100],
            visible_indices=[0, 1],
            line_count=2
        )
        result = layer.process(ctx)
        assert result.success is True
        assert result.decorations == []


class TestWidget:
    """Test Widget class"""
    
    def test_widget_defaults(self):
        widget = Widget()
        assert widget.category == LayerCategory.WIDGET
        assert widget.stage == LayerStage.RENDERING
        assert widget.icon == "widget"
        assert widget.role == "sidebar"
        assert widget.refresh_interval == 5.0
    
    def test_widget_get_data_default(self):
        widget = Widget()
        assert widget.get_data() == {}
    
    def test_widget_process(self):
        widget = Widget()
        ctx = PipelineContext(
            file_path="/test/log.txt",
            line_offsets=[0],
            visible_indices=[0],
            line_count=1
        )
        result = widget.process(ctx)
        assert result.success is True
        assert result.stats == {}


class TestLayerInheritance:
    """Test layer inheritance and type checking"""
    
    def test_filter_layer_is_layer(self):
        layer = FilterLayer()
        assert isinstance(layer, Layer)
    
    def test_transform_layer_is_layer(self):
        layer = TransformLayer()
        assert isinstance(layer, Layer)
    
    def test_highlight_layer_is_layer(self):
        layer = HighlightLayer()
        assert isinstance(layer, Layer)
    
    def test_decoration_layer_is_layer(self):
        layer = DecorationLayer()
        assert isinstance(layer, Layer)
    
    def test_widget_is_layer(self):
        widget = Widget()
        assert isinstance(widget, Layer)


class TestLayerConfigBinding:
    """Test config binding"""
    
    def test_config_binding_empty(self):
        layer = FilterLayer({})
        assert layer.config == {}
    
    def test_config_binding_preserves_config(self):
        layer = FilterLayer({"custom_key": "custom_value"})
        assert layer.config["custom_key"] == "custom_value"


class TestUISchema:
    """Test UI schema generation"""
    
    def test_filter_layer_schema(self):
        schema = FilterLayer.get_ui_schema()
        assert isinstance(schema, list)
    
    def test_highlight_layer_schema(self):
        from loglayer.builtin.highlight import HighlightLayer
        schema = HighlightLayer.get_ui_schema()
        assert isinstance(schema, list)
        assert len(schema) == 3  # query, color, opacity