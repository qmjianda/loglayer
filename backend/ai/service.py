from typing import Optional
from .config import (
    AIProvider,
    AIConfig,
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
)
from .providers import (
    BaseAIProvider,
    HeuristicProvider,
    OpenAIProvider,
    OllamaProvider,
    NoneProvider,
)


class AIService:
    """Main AI service that manages providers"""

    def __init__(self):
        self._config = AIConfig()
        self._provider: Optional[BaseAIProvider] = None
        self._heuristic = HeuristicProvider()
        self._none_provider = NoneProvider()
        self._init_provider()

    def _init_provider(self):
        """Initialize the current provider based on config"""
        if self._config.provider == AIProvider.NONE:
            self._provider = self._none_provider
        elif self._config.provider == AIProvider.OPENAI:
            self._provider = OpenAIProvider(
                api_key=self._config.apiKey, model=self._config.model
            )
        elif self._config.provider == AIProvider.OLLAMA:
            self._provider = OllamaProvider(
                model=self._config.model, base_url=self._config.baseUrl
            )
        else:
            self._provider = self._heuristic

    def update_config(self, config: AIConfig):
        """Update AI configuration"""
        old_config = self._config
        self._config = config

        if (
            old_config.provider == AIProvider.NONE
            and config.provider != AIProvider.NONE
        ):
            pass

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
        if self._config.provider == AIProvider.NONE:
            return self._none_provider.chat(messages, content)
        return self.provider.chat(messages, content)

    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Detect timestamp format"""
        if self._config.provider == AIProvider.NONE:
            return None
        result = self.provider.detect_timestamp(log_sample)
        if result is None:
            return self._heuristic.detect_timestamp(log_sample)
        return result

    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Suggest time ranges"""
        if self._config.provider == AIProvider.NONE:
            return []
        result = self.provider.suggest_time_range(log_sample)
        if not result:
            return self._heuristic.suggest_time_range(log_sample)
        return result

    def is_connected(self) -> bool:
        """Check if current provider is connected"""
        if self._config.provider == AIProvider.NONE:
            return False
        return self.provider.is_available()

    def list_models(self) -> list[str]:
        """List available models"""
        if self._config.provider == AIProvider.NONE:
            return []
        return self.provider.list_models()

    def test_connection(self) -> tuple[bool, str]:
        """Test connection to current provider"""
        if self._config.provider == AIProvider.NONE:
            return False, "AI is disabled"
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
