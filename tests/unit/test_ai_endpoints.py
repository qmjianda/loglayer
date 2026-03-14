"""Test AI endpoint error handling"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestAIEndpoints:
    """Test AI endpoint error handling"""

    def test_chat_empty_messages(self, client):
        """Test chat with empty messages"""
        response = client.post("/api/ai/chat", json={"messages": []})
        assert response.status_code == 200

    def test_chat_with_messages(self, client):
        """Test chat with valid messages"""
        response = client.post(
            "/api/ai/chat",
            json={"messages": [{"role": "user", "content": "test"}]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_detect_timestamp(self, client):
        """Test timestamp detection endpoint"""
        response = client.post(
            "/api/ai/detect-timestamp",
            json={"log_sample": "2024-01-01 10:00:00 INFO test log"}
        )
        assert response.status_code == 200

    def test_suggest_time_range(self, client):
        """Test time range suggestion endpoint"""
        response = client.post(
            "/api/ai/suggest-time-range",
            json={"log_sample": "2024-01-01 10:00:00 ERROR test"}
        )
        assert response.status_code == 200

    def test_models_endpoint(self, client):
        """Test models list endpoint"""
        response = client.get("/api/ai/models")
        assert response.status_code == 200

    def test_test_connection(self, client):
        """Test connection endpoint"""
        response = client.post("/api/ai/test-connection")
        assert response.status_code == 200
