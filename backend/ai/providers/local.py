from typing import Optional
import json
import requests
from .base import BaseAIProvider
from ..config import (
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
    AIModelParams,
)


class OllamaProvider(BaseAIProvider):
    """Ollama local LLM provider"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "llama3.2",
        base_url: Optional[str] = None,
        params: Optional[AIModelParams] = None,
    ):
        super().__init__(api_key, model, base_url, params)
        self.base_url = base_url or "http://localhost:11434"

    def _request(self, endpoint: str, data: dict) -> Optional[dict]:
        """Make request to Ollama"""
        try:
            response = requests.post(
                f"{self.base_url}{endpoint}", json=data, timeout=60
            )
            if response.status_code == 200:
                return response.json()
        except requests.exceptions.RequestException:
            pass
        return None

    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        """Send chat to Ollama"""
        prompt = f"""You are a log analysis assistant. Analyze the provided log content and:
1. Identify patterns, errors, and anomalies
2. Suggest actionable filters or highlights
3. Keep responses concise and helpful

Log content:
{content}

Provide your analysis."""

        result = self._request(
            "/api/generate", {
                "model": self.model, 
                "prompt": prompt, 
                "stream": False,
                "options": {
                    "temperature": self.params.temperature,
                    "num_predict": self.params.max_tokens,
                    "top_p": self.params.top_p,
                }
            }
        )

        if result:
            return ChatResponse(
                message=result.get("response", "No response"), suggestions=[]
            )
        return ChatResponse(
            message="Ollama is not running or model not available. Start Ollama to use local AI.",
            suggestions=[],
        )

    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Use Ollama to detect timestamp format"""
        prompt = f"""Analyze this log sample and detect the timestamp format:

{log_sample[:2000]}

Return ONLY a JSON object with:
{{"pattern": "regex with capture group", "format": "strftime or unix", "start_time": "earliest", "end_time": "latest"}}

If no timestamp, return {{"error": "none"}}"""

        result = self._request(
            "/api/generate", {"model": self.model, "prompt": prompt, "stream": False}
        )

        if result:
            try:
                text = result.get("response", "")
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    data = json.loads(text[start:end])
                    if "error" not in data:
                        return TimestampDetectionResult(
                            pattern=data.get("pattern", ""),
                            format=data.get("format", ""),
                            start_time=data.get("start_time"),
                            end_time=data.get("end_time"),
                        )
            except (json.JSONDecodeError, ValueError):
                pass
        return None

    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Use Ollama to suggest time ranges"""
        prompt = f"""Analyze this log sample and suggest time ranges:

{log_sample[:3000]}

Return ONLY a JSON array of suggestions:
[{{"start": "time", "end": "time", "description": "why", "reason": "reason"}}]

Focus on error clusters and traffic patterns. Max 5 suggestions."""

        result = self._request(
            "/api/generate", {"model": self.model, "prompt": prompt, "stream": False}
        )

        if result:
            try:
                text = result.get("response", "")
                start = text.find("[")
                end = text.rfind("]") + 1
                if start >= 0 and end > start:
                    data = json.loads(text[start:end])
                    suggestions = []
                    for item in data[:5]:
                        suggestions.append(
                            TimeRangeSuggestion(
                                start=item.get("start", ""),
                                end=item.get("end", ""),
                                description=item.get("description", ""),
                                reason=item.get("reason", ""),
                            )
                        )
                    return suggestions
            except (json.JSONDecodeError, ValueError):
                pass
        return []

    def is_available(self) -> bool:
        """Check if Ollama is running"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def test_connection(self) -> tuple[bool, str]:
        """Test actual connection to Ollama"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                if models:
                    return True, f"连接成功，已加载 {len(models)} 个模型"
                return True, "Ollama 运行中，但未下载模型"
            return False, f"服务不可用 (HTTP {response.status_code})"
        except requests.exceptions.ConnectionError:
            return False, "无法连接，请确保 Ollama 已启动 (默认端口 11434)"
        except requests.exceptions.Timeout:
            return False, "连接超时"
        except Exception as e:
            return False, f"连接失败: {str(e)[:50]}"

    def list_models(self) -> list[str]:
        """List available Ollama models"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [m["name"] for m in data.get("models", [])]
        except requests.exceptions.RequestException:
            pass
        return ["llama3.2", "llama3", "qwen2.5", "mistral"]
