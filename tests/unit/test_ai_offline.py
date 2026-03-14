"""Test heuristic provider is_offline method"""
import pytest
from backend.ai.providers.heuristic import HeuristicProvider
from backend.ai.providers.cloud import OpenAIProvider
from backend.ai.providers.local import OllamaProvider


class TestOfflineMode:
    """Test offline mode detection"""

    def test_heuristic_is_offline(self):
        """Heuristic provider should work offline"""
        provider = HeuristicProvider()
        assert provider.is_offline() is True

    def test_openai_not_offline(self):
        """OpenAI provider requires network"""
        provider = OpenAIProvider(api_key="test")
        assert provider.is_offline() is False

    def test_ollama_not_offline(self):
        """Ollama provider requires network"""
        provider = OllamaProvider()
        assert provider.is_offline() is False
