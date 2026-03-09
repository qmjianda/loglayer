"""
Pydantic schemas for API request/response validation.

This module defines all Pydantic models used for:
- Request body validation
- Response serialization
- Type safety
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Literal


class OpenFileRequest(BaseModel):
    """Request to open a file."""
    file_id: str = Field(..., min_length=1, description="Unique file identifier")
    file_path: str = Field(..., min_length=1, description="Path to the log file")

    @field_validator('file_path')
    @classmethod
    def validate_file_path(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('file_path cannot be empty')
        return v


class SyncLayersRequest(BaseModel):
    """Request to sync layers."""
    file_id: str = Field(..., min_length=1)
    layers_json: str = Field(..., description="JSON string of layer configurations")
    search_json: Optional[str] = Field(None, description="Optional search configuration")


class SyncDecorationsRequest(BaseModel):
    """Request to sync decorations."""
    file_id: str = Field(..., min_length=1)
    layers_json: str = Field(..., description="JSON string of decoration layer configs")


class ReadProcessedLinesRequest(BaseModel):
    """Request to read processed lines."""
    file_id: str = Field(..., min_length=1)
    start_line: int = Field(..., ge=0, description="Starting line index")
    count: int = Field(..., ge=1, le=1000, description="Number of lines to read (max 1000)")


class GetLinesByIndicesRequest(BaseModel):
    """Request to get lines by indices."""
    file_id: str = Field(..., min_length=1)
    indices: List[int] = Field(..., min_length=1, max_length=1000)

    @field_validator('indices')
    @classmethod
    def validate_indices(cls, v: List[int]) -> List[int]:
        if any(i < 0 for i in v):
            raise ValueError('indices must be non-negative')
        return v


class SearchRequest(BaseModel):
    """Request to search using ripgrep."""
    file_id: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1, max_length=1000)
    regex: bool = Field(default=False)
    case_sensitive: bool = Field(default=False)


class GetSearchMatchIndexRequest(BaseModel):
    """Request to get search match at rank."""
    file_id: str = Field(..., min_length=1)
    rank: int = Field(..., ge=0)


class GetNearestSearchRankRequest(BaseModel):
    """Request to get nearest search rank."""
    file_id: str = Field(..., min_length=1)
    current_index: int = Field(..., ge=0)
    direction: Literal['next', 'prev'] = Field(..., description="Search direction")


class GetSearchMatchesRangeRequest(BaseModel):
    """Request to get search matches range."""
    file_id: str = Field(..., min_length=1)
    start_rank: int = Field(..., ge=0)
    count: int = Field(..., ge=1, le=100)


class ToggleBookmarkRequest(BaseModel):
    """Request to toggle bookmark."""
    file_id: str = Field(..., min_length=1)
    line_index: int = Field(..., ge=0)


class GetNearestBookmarkRequest(BaseModel):
    """Request to get nearest bookmark."""
    file_id: str = Field(..., min_length=1)
    current_index: int = Field(..., ge=0)
    direction: Literal['next', 'prev'] = Field(...)


class UpdateBookmarkCommentRequest(BaseModel):
    """Request to update bookmark comment."""
    file_id: str = Field(..., min_length=1)
    line_index: int = Field(..., ge=0)
    comment: str = Field(default="", max_length=500)


class ExportVisibleLinesRequest(BaseModel):
    """Request to export visible lines."""
    file_id: str = Field(..., min_length=1)
    output_path: str = Field(..., min_length=1)
    format: Literal['txt', 'csv', 'json'] = Field(default='txt')


class PhysicalToVisualIndexRequest(BaseModel):
    """Request to convert physical to visual index."""
    file_id: str = Field(..., min_length=1)
    physical_index: int = Field(..., ge=0)


class CloseFileRequest(BaseModel):
    """Request to close a file."""
    file_id: str = Field(..., min_length=1)


class ListDirectoryRequest(BaseModel):
    """Request to list directory contents."""
    folder_path: str = Field(..., min_length=1)


class SaveWorkspaceConfigRequest(BaseModel):
    """Request to save workspace config."""
    folder_path: str = Field(..., min_length=1)
    config_json: str = Field(..., description="JSON string of workspace configuration")


class LoadWorkspaceConfigRequest(BaseModel):
    """Request to load workspace config."""
    folder_path: str = Field(..., min_length=1)


class GetWidgetDataRequest(BaseModel):
    """Request to get widget data."""
    type_id: str = Field(..., min_length=1)


# Response models
class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = True
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = False
    error: str
    detail: Optional[str] = None


class LogLevelStatsResponse(BaseModel):
    """Response for log level statistics."""
    ERROR: int = 0
    WARN: int = 0
    INFO: int = 0
    DEBUG: int = 0
    TRACE: int = 0
