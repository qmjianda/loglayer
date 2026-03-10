from typing import Optional
from .base import BaseAIProvider
from ..config import (
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
)


class OpenAIProvider(BaseAIProvider):
    """OpenAI API provider with support for OpenAI-compatible third-party APIs"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        is_custom: bool = False,
    ):
        super().__init__(api_key, model, base_url)
        self._client = None
        self._is_custom = is_custom

    def _get_client(self):
        """Lazy load OpenAI client"""
        if self._client is None:
            try:
                from openai import OpenAI

                self._client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url or "https://api.openai.com/v1",
                )
            except ImportError:
                return None
        return self._client

    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        """Send chat to OpenAI"""
        client = self._get_client()
        if not client:
            return ChatResponse(
                message="OpenAI client not available. Please install openai package.",
                suggestions=[],
            )

        try:
            system_prompt = """You are a log analysis assistant. Analyze the provided log content and:
1. Identify patterns, errors, and anomalies
2. Suggest actionable filters or highlights
3. Keep responses concise and helpful

Format suggestions as JSON with "type" (filter/highlight), "value", and "reason" fields."""

            openai_messages = [{"role": "system", "content": system_prompt}]
            for msg in messages:
                openai_messages.append({"role": msg.role, "content": msg.content})
            if content:
                openai_messages.append({"role": "user", "content": content})

            response = client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=0.7,
            )

            response_text = response.choices[0].message.content or ""

            suggestions = []
            if "filter:" in response_text.lower():
                suggestions.append({"type": "filter", "action": "parse_from_response"})
            if "highlight:" in response_text.lower():
                suggestions.append(
                    {"type": "highlight", "action": "parse_from_response"}
                )

            return ChatResponse(message=response_text, suggestions=suggestions)
        except Exception as e:
            return ChatResponse(message=f"Error: {str(e)}", suggestions=[])

    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Use OpenAI to detect timestamp format"""
        client = self._get_client()
        if not client:
            return None

        try:
            prompt = f"""Analyze this log sample and detect the timestamp format:

{log_sample[:2000]}

Return JSON with:
- "pattern": regex pattern with one capture group for the timestamp
- "format": Python strftime format (or "unix" for epoch)
- "start_time": earliest timestamp found
- "end_time": latest timestamp found

If no timestamp found, return {{"error": "no timestamp"}}"""

            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            import json

            result = json.loads(response.choices[0].message.content)

            if "error" in result:
                return None

            return TimestampDetectionResult(
                pattern=result.get("pattern", ""),
                format=result.get("format", ""),
                start_time=result.get("start_time"),
                end_time=result.get("end_time"),
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None

    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Use OpenAI to suggest time ranges"""
        client = self._get_client()
        if not client:
            return []

        try:
            prompt = f"""Analyze this log sample and suggest interesting time ranges:

{log_sample[:3000]}

Return JSON array of suggestions, each with:
- "start": start time
- "end": end time  
- "description": human readable description
- "reason": why this range is interesting (error_cluster, traffic_spike, etc.)

Focus on:
- Time ranges with high error density
- Unusual traffic patterns
- Any anomalies

Return empty array if no timestamps found."""

            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            import json

            result = json.loads(response.choices[0].message.content)

            suggestions = []
            for item in result.get("suggestions", [])[:5]:
                suggestions.append(
                    TimeRangeSuggestion(
                        start=item.get("start", ""),
                        end=item.get("end", ""),
                        description=item.get("description", ""),
                        reason=item.get("reason", ""),
                    )
                )
            return suggestions
        except (json.JSONDecodeError, KeyError, TypeError):
            return []

    def is_available(self) -> bool:
        """Check if OpenAI is configured"""
        return bool(self.api_key)

    def test_connection(self) -> tuple[bool, str]:
        """Test actual connection to OpenAI API or custom endpoint"""
        if not self.api_key:
            return False, "API Key 未设置"

        client = self._get_client()
        if not client:
            return False, "OpenAI 客户端不可用"

        try:
            if self._is_custom and self.base_url:
                response = client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5,
                )
            else:
                response = client.models.list()
                return True, f"连接成功，已获取 {len(response.data)} 个模型"
            
            if response.choices and len(response.choices) > 0:
                return True, "连接成功"
            return False, "连接成功但无法获取响应"
        except Exception as e:
            error_msg = str(e)
            if "authentication" in error_msg.lower() or "api key" in error_msg.lower():
                return False, "API Key 无效"
            elif "connection" in error_msg.lower() or "timeout" in error_msg.lower() or "refused" in error_msg.lower():
                return False, "连接失败，请检查网络和地址"
            elif "404" in error_msg or "model" in error_msg.lower():
                return False, f"模型 {self.model} 不存在，请检查模型名称"
            elif "400" in error_msg:
                return False, "请求格式错误"
            else:
                return False, f"连接失败: {error_msg[:80]}"

    def list_models(self) -> list[str]:
        """List available OpenAI models or fetch from custom endpoint"""
        if self._is_custom and self.base_url:
            return self._fetch_models_from_custom_endpoint()
        return ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]

    def _fetch_models_from_custom_endpoint(self) -> list[str]:
        """Fetch models from custom OpenAI-compatible endpoint"""
        try:
            import requests
            response = requests.get(
                f"{self.base_url.rstrip('/v1').rstrip('/')}/v1/models",
                headers={"Authorization": f"Bearer {self.api_key}"} if self.api_key else {},
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                return [m.get("id") for m in data.get("data", []) if m.get("id")]
        except Exception:
            pass
        return []
