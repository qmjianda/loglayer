from typing import Optional
from .config import (
    AIProvider,
    AIConfig,
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
    load_ai_config,
    save_ai_config,
)
from .providers import BaseAIProvider, HeuristicProvider, OpenAIProvider, OllamaProvider
from .retry import retry_api_call


class AIService:
    """Main AI service that manages providers"""

    def __init__(self):
        self._config = load_ai_config()
        self._provider: Optional[BaseAIProvider] = None
        self._heuristic = HeuristicProvider()
        self._init_provider()

    def _init_provider(self):
        """Initialize the current provider based on config"""
        if self._config.provider == AIProvider.OPENAI:
            self._provider = OpenAIProvider(
                api_key=self._config.api_key, 
                model=self._config.model, 
                base_url=self._config.base_url,
                params=self._config.params,
            )
        elif self._config.provider == AIProvider.CUSTOM:
            self._provider = OpenAIProvider(
                api_key=self._config.api_key,
                model=self._config.model,
                base_url=self._config.base_url,
                is_custom=True,
                params=self._config.params,
            )
        elif self._config.provider == AIProvider.OLLAMA:
            self._provider = OllamaProvider(
                model=self._config.model, 
                base_url=self._config.base_url,
                params=self._config.params,
            )
        else:
            self._provider = self._heuristic

    def update_config(self, config: AIConfig):
        """Update AI configuration"""
        self._config = config
        self._init_provider()
        save_ai_config(config)

    def get_config(self) -> AIConfig:
        """Get current configuration"""
        return self._config

    @property
    def provider(self) -> BaseAIProvider:
        """Get current provider"""
        if self._provider and self._provider.is_available():
            return self._provider
        return self._heuristic

    @retry_api_call
    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        """Send chat message"""
        return self.provider.chat(messages, content)

    @retry_api_call
    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Detect timestamp format"""
        result = self.provider.detect_timestamp(log_sample)
        if result is None:
            return self._heuristic.detect_timestamp(log_sample)
        return result

    @retry_api_call
    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Suggest time ranges"""
        result = self.provider.suggest_time_range(log_sample)
        if not result:
            return self._heuristic.suggest_time_range(log_sample)
        return result

    def is_connected(self) -> bool:
        """Check if current provider is connected"""
        return self.provider.is_available()

    def is_configured(self) -> bool:
        """Check if AI is properly configured (not using default/heuristic)"""
        return self._config.provider != AIProvider.HEURISTIC

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
