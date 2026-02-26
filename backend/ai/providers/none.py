from typing import Optional
from ..config import (
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
)
from .base import BaseAIProvider


class NoneProvider(BaseAIProvider):
    """Provider that returns empty results - used when AI is disabled"""

    def __init__(self):
        super().__init__(api_key=None, model="", base_url=None)

    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        return ChatResponse(message="AI is disabled", suggestions=[])

    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        return None

    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        return []

    def is_available(self) -> bool:
        return False

    def list_models(self) -> list[str]:
        return []
