"""
Shared type schemas for frontend-backend communication.

These Pydantic models mirror the TypeScript types in frontend/src/types.ts
to ensure type safety across the API boundary.
"""

from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict


class LayerTypeEnum(str, Enum):
    """Layer type enumeration - matches frontend LayerType enum."""
    FILTER = "FILTER"
    HIGHLIGHT = "HIGHLIGHT"
    RANGE = "RANGE"
    MARK = "MARK"
    TIME_RANGE = "TIME_RANGE"
    LEVEL = "LEVEL"
    TRANSFORM = "TRANSFORM"
    EXTRACT = "EXTRACT"
    FOLDER = "FOLDER"
    PYTHON = "PYTHON"


class LayerUIFieldType(str, Enum):
    """UI field type for layer configuration."""
    STR = "str"
    INT = "int"
    BOOL = "bool"
    DROPDOWN = "dropdown"
    COLOR = "color"
    MULTISELECT = "multiselect"
    SEARCH = "search"
    RANGE = "range"


class LayerUIFieldOption(BaseModel):
    """Option for dropdown/multiselect fields."""
    label: str
    value: str


class LayerUIField(BaseModel):
    """UI schema for a layer configuration field."""
    name: str
    type: LayerUIFieldType
    display_name: str
    value: Optional[Union[str, int, bool, List[str]]] = None
    info: Optional[str] = None
    options: Optional[List[Union[str, LayerUIFieldOption]]] = None
    min: Optional[int] = None
    max: Optional[int] = None
    regex: Optional[bool] = None
    caseSensitive: Optional[bool] = None
    wholeWord: Optional[bool] = None
    showRegex: Optional[bool] = None
    showCaseSensitive: Optional[bool] = None
    showWholeWord: Optional[bool] = None


class LayerRegistryEntry(BaseModel):
    """Registry entry for a layer type."""
    type: str
    display_name: str
    description: str
    icon: str
    ui_schema: List[LayerUIField] = Field(default_factory=list)
    is_builtin: bool = True
    category: Optional[str] = None  # FILTER, TRANSFORM, HIGHLIGHT, DECORATION, WIDGET
    stage: Optional[str] = None     # LOGIC, RENDERING


class LayerConfig(BaseModel):
    """Configuration for a layer instance."""
    model_config = ConfigDict(extra="allow")
    query: Optional[str] = None
    regex: Optional[bool] = None
    caseSensitive: Optional[bool] = None
    wholeWord: Optional[bool] = None
    invert: Optional[bool] = None
    levels: Optional[List[str]] = None
    color: Optional[str] = None
    opacity: Optional[float] = None


class LogLayer(BaseModel):
    """A layer instance in the processing pipeline."""
    id: str
    name: str
    type: LayerTypeEnum
    enabled: bool = True
    isLocked: Optional[bool] = None
    isCollapsed: Optional[bool] = None
    groupId: Optional[str] = None
    config: LayerConfig = Field(default_factory=LayerConfig)


class LayerPreset(BaseModel):
    """A saved preset of layer configurations."""
    id: str
    name: str
    layers: List[LogLayer] = Field(default_factory=list)


class LayerStats(BaseModel):
    """Statistics for a layer."""
    count: int = 0
    distribution: List[float] = Field(default_factory=list)


class RowStyle(BaseModel):
    """Style information for a log row."""
    backgroundColor: Optional[str] = None
    color: Optional[str] = None


class Highlight(BaseModel):
    """Highlight information for text ranges."""
    start: int
    end: int
    color: str
    opacity: float = 1.0
    isSearch: Optional[bool] = None


class LogLine(BaseModel):
    """A processed log line with metadata."""
    index: int
    content: str
    displayContent: Optional[str] = None
    highlights: Optional[List[Highlight]] = None
    isMarked: Optional[bool] = None
    bookmarkComment: Optional[str] = None
    rowStyle: Optional[RowStyle] = None


class ProcessedCache(BaseModel):
    """Cache for processed line metadata."""
    model_config = ConfigDict(extra="allow")
    searchMatchCount: Optional[int] = None
    layerStats: Optional[Dict[str, LayerStats]] = None


class FileLoadedPayload(BaseModel):
    """Payload emitted when a file is loaded."""
    name: str
    size: int
    lineCount: int
    partial: Optional[bool] = None
    sparse: Optional[bool] = None


class SearchConfig(BaseModel):
    """Search configuration."""
    query: str = ""
    regex: bool = False
    caseSensitive: bool = False
    wholeWord: bool = False


class PlatformInfo(BaseModel):
    """Platform information response."""
    os: str
    hasNativeDialogs: bool


class WorkerConfig(BaseModel):
    """Worker pool configuration."""
    max_workers: int = 4
    cpu_count: int = 4