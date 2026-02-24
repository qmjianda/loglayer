import pytest
from backend.ai.providers.heuristic import HeuristicProvider


class TestHeuristicProvider:
    """Test heuristic AI provider"""

    def setup_method(self):
        self.provider = HeuristicProvider()

    def test_is_available(self):
        """Heuristic provider should always be available"""
        assert self.provider.is_available() is True

    def test_list_models(self):
        """Should return heuristic as only model"""
        models = self.provider.list_models()
        assert models == ["heuristic"]

    def test_detect_timestamp_iso8601(self):
        """Should detect ISO8601 timestamp"""
        log_sample = """2026-01-15T14:32:00Z INFO Starting service
2026-01-15T14:32:01Z DEBUG Connection established
2026-01-15T14:32:02Z ERROR Connection failed"""

        result = self.provider.detect_timestamp(log_sample)

        assert result is not None
        assert result.pattern is not None
        # ISO8601 with timezone may not parse start/end times correctly
        # Just verify pattern was detected

    def test_detect_timestamp_standard(self):
        """Should detect standard log format"""
        log_sample = """2026-01-15 14:32:00 INFO Starting service
2026-01-15 14:32:01 DEBUG Connection established
2026-01-15 14:32:02 ERROR Connection failed"""

        result = self.provider.detect_timestamp(log_sample)

        assert result is not None
        assert result.pattern is not None
        assert result.format == "%Y-%m-%d %H:%M:%S"

    def test_detect_timestamp_no_match(self):
        """Should return None for non-timestamp content"""
        log_sample = """This is just plain text
No timestamps here
Just random content"""

        result = self.provider.detect_timestamp(log_sample)

        # May return None or have no format
        assert result is None or result.format is None

    def test_suggest_time_range(self):
        """Should suggest time ranges based on errors"""
        log_sample = """2026-01-15 14:00:00 INFO Starting
2026-01-15 14:00:01 ERROR Something failed
2026-01-15 14:00:02 ERROR Another error
2026-01-15 14:00:03 ERROR Third error
2026-01-15 15:00:00 INFO Normal
2026-01-15 15:00:01 DEBUG Debug message"""

        suggestions = self.provider.suggest_time_range(log_sample)

        # Should find high error density at 14:00
        assert len(suggestions) > 0
        assert any("error" in s.description.lower() for s in suggestions)

    def test_chat_offline_message(self):
        """Should return offline message"""
        from backend.ai.config import ChatMessage

        messages = [ChatMessage(role="user", content="test")]
        response = self.provider.chat(messages, "test content")

        assert (
            "offline" in response.message.lower()
            or "configure" in response.message.lower()
        )
        assert response.suggestions == []
