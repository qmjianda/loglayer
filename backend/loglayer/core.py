"""
LogLayer Core - Layer System Architecture

Three-stage, five-category architecture for high-performance log processing:

Execution Stages:
- NATIVE: ripgrep-based parallel processing (fastest)
- LOGIC: Python single/multi-threaded processing (medium)
- RENDERING: lightweight visual-only refresh (fastest)

Categories:
- FILTER: Line-level visibility (determines if line is visible)
- TRANSFORM: Content modification (changes line content)
- HIGHLIGHT: Text-level highlighting (adds color to text)
- DECORATION: Row-level styling (background, font style)
- WIDGET: Independent UI components (sidebar, statusbar)
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum


# ============================================================
# Enums - Stage and Category
# ============================================================


class LayerStage(str, Enum):
    """Layer execution stage"""

    NATIVE = "native"  # ripgrep parallel processing
    LOGIC = "logic"  # Python processing
    RENDERING = "rendering"  # lightweight visual refresh


class LayerCategory(str, Enum):
    """Layer functional category"""

    FILTER = "filter"  # Line filtering
    TRANSFORM = "transform"  # Content transformation
    HIGHLIGHT = "highlight"  # Text highlighting
    DECORATION = "decoration"  # Row decoration
    WIDGET = "widget"  # Independent UI component


# ============================================================
# Data Classes - Results and Context
# ============================================================


@dataclass
class Highlight:
    """Text highlight region"""

    start: int
    end: int
    color: str = "#3b82f6"
    opacity: float = 100.0


@dataclass
class RowStyle:
    """Row-level styling"""

    background_color: Optional[str] = None
    color: Optional[str] = None
    font_weight: Optional[str] = None


@dataclass
class ProcessedLine:
    """Processed line information"""

    content: str
    offset_map: Optional[Dict[int, int]] = None


@dataclass
class LayerResult:
    """Result from layer processing"""

    success: bool
    indices: Optional[List[int]] = None  # Filtered line indices
    highlights: Optional[List[Highlight]] = None  # Highlight regions
    decorations: Optional[List[RowStyle]] = None  # Row decorations
    stats: Optional[Dict[str, Any]] = None  # Statistics
    transformed_lines: Optional[Dict[int, str]] = None  # Transformed content
    error: Optional[str] = None


@dataclass
class PipelineContext:
    """Pipeline execution context"""

    file_path: str
    line_offsets: List[int]
    visible_indices: List[int]
    line_count: int

    # Caches
    filter_cache: Dict[str, Set[int]] = field(default_factory=dict)
    transform_cache: Dict[int, str] = field(default_factory=dict)
    highlight_cache: Dict[int, List[Highlight]] = field(default_factory=dict)
    decoration_cache: Dict[int, RowStyle] = field(default_factory=dict)


# ============================================================
# Base Layer Class
# ============================================================


class Layer(ABC):
    """
    Base layer class.
    All layers must inherit from this and implement process().
    """

    type_id: str = "base"
    display_name: str = "Base Layer"
    description: str = ""
    icon: str = "layer"
    category: LayerCategory = LayerCategory.FILTER
    stage: LayerStage = LayerStage.LOGIC
    is_builtin: bool = True
    is_system_managed: bool = False
    inputs: List[Any] = []

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.id: Optional[str] = None
        self._bind_config()

    def _bind_config(self) -> None:
        """Bind config to instance attributes"""
        from .ui import SearchInput

        for inp in self.inputs:
            if isinstance(inp, SearchInput):
                setattr(self, inp.name, self.config.get(inp.name, inp.value))
                setattr(
                    self,
                    f"{inp.name}_regex",
                    self.config.get("regex", inp.kwargs.get("regex", False)),
                )
                setattr(
                    self,
                    f"{inp.name}_caseSensitive",
                    self.config.get("caseSensitive", inp.kwargs.get("caseSensitive", False)),
                )
                setattr(
                    self,
                    f"{inp.name}_wholeWord",
                    self.config.get("wholeWord", inp.kwargs.get("wholeWord", False)),
                )

                # Legacy names for single-search components
                if not hasattr(self, "regex"):
                    setattr(self, "regex", getattr(self, f"{inp.name}_regex", False))
                if not hasattr(self, "caseSensitive"):
                    setattr(
                        self, "caseSensitive", getattr(self, f"{inp.name}_caseSensitive", False)
                    )
                if not hasattr(self, "wholeWord"):
                    setattr(self, "wholeWord", getattr(self, f"{inp.name}_wholeWord", False))
            else:
                setattr(self, inp.name, self.config.get(inp.name, inp.value))

    @classmethod
    def get_ui_schema(cls) -> List[Dict[str, Any]]:
        """Return UI schema for dynamic rendering"""
        return [inp.to_dict() for inp in cls.inputs]

    def reset(self) -> None:
        """Reset layer state (called when config changes)"""
        pass

    @abstractmethod
    def process(self, context: PipelineContext) -> LayerResult:
        """
        Main processing entry point.
        Must be implemented by subclasses.
        """
        pass

    def get_summary(self) -> str:
        """Return human-readable summary of current configuration"""
        return self.description


# ============================================================
# Filter Layer - Line-level filtering
# ============================================================


class FilterLayer(Layer):
    """
    Filter layer - determines if a log line should be visible.

    Returns True to keep the line, False to discard it.
    """

    category: LayerCategory = LayerCategory.FILTER
    stage: LayerStage = LayerStage.LOGIC
    icon: str = "filter"

    def filter_line(self, content: str, index: int = -1) -> bool:
        """Return True: keep; False: discard"""
        return True

    def process(self, context: PipelineContext) -> LayerResult:
        """Default implementation - pass all lines through"""
        return LayerResult(success=True, indices=list(range(context.line_count)))


class NativeFilterLayer(FilterLayer):
    """
    High-performance native filter layer using ripgrep.
    """

    stage: LayerStage = LayerStage.NATIVE

    def get_rg_args(self) -> List[str]:
        """Return ripgrep arguments"""
        return []


# ============================================================
# Transform Layer - Content transformation
# ============================================================


class TransformLayer(Layer):
    """
    Transform layer - modifies log line content.

    Used for text replacement, formatting, field extraction.
    """

    category: LayerCategory = LayerCategory.TRANSFORM
    stage: LayerStage = LayerStage.LOGIC
    icon: str = "replace"

    def transform_line(self, content: str) -> str:
        """Return transformed content"""
        return content

    def process(self, context: PipelineContext) -> LayerResult:
        """Default implementation - no transformation"""
        return LayerResult(success=True, transformed_lines={})


# ============================================================
# Highlight Layer - Text highlighting
# ============================================================


class HighlightLayer(Layer):
    """
    Highlight layer - adds color to matched text.

    Returns list of highlight regions (start, end, color).
    """

    category: LayerCategory = LayerCategory.HIGHLIGHT
    stage: LayerStage = LayerStage.RENDERING
    icon: str = "highlight"

    def get_highlights(self, content: str) -> List[Highlight]:
        """Return highlight regions for the content"""
        return []

    def process(self, context: PipelineContext) -> LayerResult:
        """Default implementation - no highlights"""
        return LayerResult(success=True, highlights=[])


# ============================================================
# Decoration Layer - Row-level styling
# ============================================================


class DecorationLayer(Layer):
    """
    Decoration layer - applies row-level styling.

    Returns row style (background color, font color, etc).
    """

    category: LayerCategory = LayerCategory.DECORATION
    stage: LayerStage = LayerStage.RENDERING
    icon: str = "palette"

    def get_row_style(self, content: str, index: int = -1) -> RowStyle:
        """Return row style"""
        return RowStyle()

    def process(self, context: PipelineContext) -> LayerResult:
        """Default implementation - no decoration"""
        return LayerResult(success=True, decorations=[])


# ============================================================
# Widget - Independent UI Components
# ============================================================


class Widget(Layer):
    """
    Widget - independent UI component that doesn't participate in Pipeline.

    Runs asynchronously, provides data for sidebar/statusbar panels.
    Examples: TimelineHistogram, StatsPanel, LabelPanel
    """

    category: LayerCategory = LayerCategory.WIDGET
    stage: LayerStage = LayerStage.RENDERING
    icon: str = "widget"
    role: str = "sidebar"  # sidebar | statusbar | panel
    refresh_interval: float = 5.0

    def get_data(self) -> Dict[str, Any]:
        """Return data to render in UI"""
        return {}

    def process(self, context: PipelineContext) -> LayerResult:
        """Widgets don't participate in main pipeline"""
        return LayerResult(success=True, stats=self.get_data())
