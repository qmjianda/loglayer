import pytest
from unittest.mock import Mock, patch, MagicMock
from backend.ai.providers.cloud import OpenAIProvider
from backend.ai.config import ChatMessage, TimestampDetectionResult, TimeRangeSuggestion


class TestOpenAIProvider:
    """Test OpenAI provider with mocked responses"""

    def setup_method(self):
        self.provider = OpenAIProvider(api_key="test-key", model="gpt-4o-mini")

    def test_is_available_with_key(self):
        """Should be available when API key is set"""
        assert self.provider.is_available() is True

    def test_is_available_without_key(self):
        """Should not be available without API key"""
        provider = OpenAIProvider(api_key=None)
        assert provider.is_available() is False

    def test_is_offline(self):
        """OpenAI provider should not work offline"""
        assert self.provider.is_offline() is False

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_chat_success(self, mock_openai_class):
        """Test successful chat completion"""
        # Setup mock
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = "This is a test response"
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        # Call the method
        messages = [ChatMessage(role="user", content="test message")]
        response = self.provider.chat(messages, "test content")

        # Verify
        assert response.message == "This is a test response"
        assert isinstance(response.suggestions, list)
        mock_client.chat.completions.create.assert_called_once()

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_chat_with_filter_suggestion(self, mock_openai_class):
        """Test chat response with filter suggestion parsing"""
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = "Found errors. filter: level=ERROR"
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        messages = [ChatMessage(role="user", content="test")]
        response = self.provider.chat(messages, "test")

        assert "filter:" in response.message.lower()
        assert any(s.get("type") == "filter" for s in response.suggestions)

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_chat_error_handling(self, mock_openai_class):
        """Test chat error handling"""
        mock_client = Mock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        mock_openai_class.return_value = mock_client

        messages = [ChatMessage(role="user", content="test")]
        response = self.provider.chat(messages, "test")

        assert "Error" in response.message
        assert response.suggestions == []

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_detect_timestamp_success(self, mock_openai_class):
        """Test successful timestamp detection"""
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = '{"pattern": "(\\d{4}-\\d{2}-\\d{2})", "format": "%Y-%m-%d", "start_time": "2024-01-01", "end_time": "2024-01-02"}'
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        result = self.provider.detect_timestamp("2024-01-01 test log\n2024-01-02 another log")

        assert result is not None
        assert result.pattern == "(\\d{4}-\\d{2}-\\d{2})"
        assert result.format == "%Y-%m-%d"

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_detect_timestamp_no_timestamp(self, mock_openai_class):
        """Test timestamp detection when no timestamp found"""
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = '{"error": "no timestamp"}'
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        result = self.provider.detect_timestamp("plain text without timestamps")

        assert result is None

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_detect_timestamp_invalid_json(self, mock_openai_class):
        """Test timestamp detection with invalid JSON response"""
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = "invalid json"
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        result = self.provider.detect_timestamp("test log content")

        assert result is None

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_suggest_time_range_success(self, mock_openai_class):
        """Test successful time range suggestion"""
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = '{"suggestions": [{"start": "14:00:00", "end": "14:59:59", "description": "High error rate", "reason": "error_cluster"}]}'
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        suggestions = self.provider.suggest_time_range("test log with errors")

        assert len(suggestions) == 1
        assert suggestions[0].reason == "error_cluster"

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_suggest_time_range_empty(self, mock_openai_class):
        """Test time range suggestion with empty result"""
        mock_client = Mock()
        mock_response = Mock()
        mock_choice = Mock()
        mock_choice.message.content = '{"suggestions": []}'
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai_class.return_value = mock_client

        suggestions = self.provider.suggest_time_range("test log")

        assert suggestions == []

    @patch("backend.ai.providers.cloud.OpenAI")
    def test_test_connection_success(self, mock_openai_class):
        """Test successful connection test"""
        mock_client = Mock()
        mock_response = Mock()
        mock_model = Mock()
        mock_model.id = "gpt-4"
        mock_response.data = [mock_model]
        mock_client.models.list.return_value = mock_response
        mock_openai_class.return_value = mock_client

        connected, message = self.provider.test_connection()

        assert connected is True
        assert "成功" in message or "success" in message.lower()

    def test_list_models_standard(self):
        """Test listing standard OpenAI models"""
        models = self.provider.list_models()

        assert "gpt-4o-mini" in models
        assert "gpt-4o" in models
        assert "gpt-3.5-turbo" in models

    def test_list_models_custom_endpoint(self):
        """Test listing models from custom endpoint"""
        provider = OpenAIProvider(
            api_key="test-key",
            model="custom-model",
            base_url="https://custom.api.com/v1",
            is_custom=True
        )

        # Should attempt to fetch from custom endpoint
        with patch.object(provider, '_fetch_models_from_custom_endpoint', return_value=["custom-model-1", "custom-model-2"]):
            models = provider.list_models()
            assert "custom-model-1" in models

    @patch("requests.get")
    def test_fetch_models_from_custom_endpoint(self, mock_get):
        """Test fetching models from custom OpenAI-compatible endpoint"""
        provider = OpenAIProvider(
            api_key="test-key",
            base_url="https://custom.api.com/v1",
            is_custom=True
        )

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": [{"id": "model1"}, {"id": "model2"}]}
        mock_get.return_value = mock_response

        models = provider._fetch_models_from_custom_endpoint()

        assert "model1" in models
        assert "model2" in models
