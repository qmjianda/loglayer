from abc import ABC, abstractmethod
from typing import Optional, Tuple
from ..config import (
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
    AIModelParams,
)


class BaseAIProvider(ABC):
    """Base class for AI providers"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        params: Optional[AIModelParams] = None,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.params = params or AIModelParams()

    @abstractmethod
    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        """Send chat message and get response"""
        pass

    @abstractmethod
    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Detect timestamp format from log sample"""
        pass

    @abstractmethod
    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Suggest interesting time ranges"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is available"""
        pass

    @abstractmethod
    def list_models(self) -> list[str]:
        """List available models"""
        pass

    def test_connection(self) -> Tuple[bool, str]:
        """Test connection to provider. Override in subclass for real test."""
        if self.is_available():
            return True, "Connected"
        return False, "Not available"
