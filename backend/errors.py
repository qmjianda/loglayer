"""
LogLayer Error Classes

Typed error hierarchy for structured error handling across the application.
Each error class has a unique code for easy identification and searching.
"""

from typing import Optional, Any


class LogLayerError(Exception):
    """
    Base error class for LogLayer.
    
    All application errors should inherit from this class.
    Each error has a code and message for structured error handling.
    """
    
    code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred"
    
    def __init__(self, message: Optional[str] = None, details: Optional[Any] = None):
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)
    
    def to_dict(self) -> dict:
        """Convert error to dictionary for API response."""
        result = {
            "code": self.code,
            "message": self.message,
        }
        if self.details is not None:
            result["details"] = self.details
        return result


class FileNotFoundError(LogLayerError):
    """Raised when a requested file does not exist."""
    
    code = "FILE_NOT_FOUND"
    message = "The requested file was not found"


class InvalidParamsError(LogLayerError):
    """Raised when request parameters are invalid."""
    
    code = "INVALID_PARAMS"
    message = "Invalid request parameters"


class OperationFailedError(LogLayerError):
    """Raised when an operation fails."""
    
    code = "OPERATION_FAILED"
    message = "The operation failed"


class PermissionDeniedError(LogLayerError):
    """Raised when access is denied."""
    
    code = "PERMISSION_DENIED"
    message = "Permission denied"


class FileOpenError(LogLayerError):
    """Raised when a file cannot be opened."""
    
    code = "FILE_OPEN_ERROR"
    message = "Failed to open file"


class IndexingError(LogLayerError):
    """Raised when file indexing fails."""
    
    code = "INDEXING_ERROR"
    message = "Failed to index file"


class PipelineError(LogLayerError):
    """Raised when layer pipeline execution fails."""
    
    code = "PIPELINE_ERROR"
    message = "Layer pipeline execution failed"


class SearchError(LogLayerError):
    """Raised when search operation fails."""
    
    code = "SEARCH_ERROR"
    message = "Search operation failed"


class ExportError(LogLayerError):
    """Raised when export operation fails."""
    
    code = "EXPORT_ERROR"
    message = "Export operation failed"


class PluginError(LogLayerError):
    """Raised when plugin operation fails."""
    
    code = "PLUGIN_ERROR"
    message = "Plugin operation failed"