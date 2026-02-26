from typing import Optional
from .config import (
    AIProvider,
    AIConfig,
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
)
from .providers import BaseAIProvider, HeuristicProvider, OpenAIProvider, OllamaProvider


class AIService:
    """Main AI service that manages providers"""

    def __init__(self):
        self._config = AIConfig()
        self._provider: Optional[BaseAIProvider] = None
        self._heuristic = HeuristicProvider()
        self._init_provider()

    def _init_provider(self):
        """Initialize the current provider based on config"""
        if self._config.provider == AIProvider.OPENAI:
            self._provider = OpenAIProvider(
                api_key=self._config.api_key, model=self._config.model
            )
        elif self._config.provider == AIProvider.OLLAMA:
            self._provider = OllamaProvider(
                model=self._config.model, base_url=self._config.base_url
            )
        else:
            self._provider = self._heuristic

    def update_config(self, config: AIConfig):
        """Update AI configuration"""
        self._config = config
        self._init_provider()

    def get_config(self) -> AIConfig:
        """Get current configuration"""
        return self._config

    @property
    def provider(self) -> BaseAIProvider:
        """Get current provider"""
        if self._provider and self._provider.is_available():
            return self._provider
        return self._heuristic

    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        """Send chat message"""
        return self.provider.chat(messages, content)

    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Detect timestamp format"""
        result = self.provider.detect_timestamp(log_sample)
        if result is None:
            return self._heuristic.detect_timestamp(log_sample)
        return result

    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Suggest time ranges"""
        result = self.provider.suggest_time_range(log_sample)
        if not result:
            return self._heuristic.suggest_time_range(log_sample)
        return result

    def is_connected(self) -> bool:
        """Check if current provider is connected"""
        return self.provider.is_available()

    def list_models(self) -> list[str]:
        """List available models"""
        return self.provider.list_models()

    def test_connection(self) -> tuple[bool, str]:
        """Test connection to current provider"""
        # Try to use provider's own test_connection if available
        if hasattr(self.provider, "test_connection"):
            return self.provider.test_connection()

        # Fallback to is_available check
        if self.provider.is_available():
            return True, "Connected"
        return False, "Not available"


_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get singleton AI service instance"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
