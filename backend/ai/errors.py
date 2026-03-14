"""AI module error handling with user-friendly messages"""

from enum import Enum
from typing import Optional


class AIErrorCode(Enum):
    """AI error codes"""
    CONFIG_NOT_SET = "config_not_set"
    PROVIDER_NOT_SUPPORTED = "provider_not_supported"
    CONNECTION_FAILED = "connection_failed"
    API_KEY_INVALID = "api_key_invalid"
    MODEL_NOT_FOUND = "model_not_found"
    RATE_LIMITED = "rate_limited"
    TIMEOUT = "timeout"
    NETWORK_ERROR = "network_error"
    UNKNOWN_ERROR = "unknown_error"
    NO_CONTENT = "no_content"
    TIMESTAMP_NOT_DETECTED = "timestamp_not_detected"


class AIError(Exception):
    """Base AI error with user-friendly message"""
    
    ERROR_MESSAGES = {
        AIErrorCode.CONFIG_NOT_SET: {
            "title": "AI 未配置",
            "message": "请先前往设置面板配置 AI Provider。支持本地 Ollama 或云端 OpenAI。",
            "action": "打开设置 (Ctrl+,)"
        },
        AIErrorCode.PROVIDER_NOT_SUPPORTED: {
            "title": "不支持的 Provider",
            "message": "当前仅支持 local (Ollama) 和 cloud (OpenAI) 两种 Provider。",
            "action": "检查配置"
        },
        AIErrorCode.CONNECTION_FAILED: {
            "title": "连接失败",
            "message": "无法连接到 AI 服务。请检查：\n1. Ollama 是否已启动 (本地模式)\n2. 网络连接是否正常 (云端模式)\n3. API Key 是否正确",
            "action": "测试连接"
        },
        AIErrorCode.API_KEY_INVALID: {
            "title": "API Key 无效",
            "message": "API Key 验证失败。请检查：\n1. Key 是否输入正确\n2. 是否有足够的额度\n3. Key 是否已过期",
            "action": "重新配置"
        },
        AIErrorCode.MODEL_NOT_FOUND: {
            "title": "模型未找到",
            "message": "指定的模型不可用。请检查模型名称是否正确，或尝试拉取模型：\nollama pull <model_name>",
            "action": "选择其他模型"
        },
        AIErrorCode.RATE_LIMITED: {
            "title": "请求过于频繁",
            "message": "已达到速率限制。请稍后再试，或升级您的 API 计划。",
            "action": "稍后重试"
        },
        AIErrorCode.TIMEOUT: {
            "title": "请求超时",
            "message": "AI 服务响应时间过长。可能原因：\n1. 本地模型加载中\n2. 网络延迟\n3. 模型处理繁忙",
            "action": "重试"
        },
        AIErrorCode.NETWORK_ERROR: {
            "title": "网络错误",
            "message": "网络连接异常。请检查您的网络设置。",
            "action": "检查网络"
        },
        AIErrorCode.NO_CONTENT: {
            "title": "内容为空",
            "message": "请提供日志内容后再进行分析。",
            "action": "粘贴日志"
        },
        AIErrorCode.TIMESTAMP_NOT_DETECTED: {
            "title": "未识别到时间戳",
            "message": "无法从提供的日志样本中识别时间戳格式。请手动配置或提供更多样本。",
            "action": "手动配置"
        },
        AIErrorCode.UNKNOWN_ERROR: {
            "title": "未知错误",
            "message": "发生未知错误。请查看日志获取详细信息。",
            "action": "查看日志"
        }
    }
    
    def __init__(self, code: AIErrorCode, detail: Optional[str] = None):
        self.code = code
        self.detail = detail
        error_info = self.ERROR_MESSAGES.get(code, self.ERROR_MESSAGES[AIErrorCode.UNKNOWN_ERROR])
        self.title = error_info["title"]
        self.user_message = error_info["message"]
        self.suggested_action = error_info["action"]
        super().__init__(f"{self.title}: {self.user_message}")
    
    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "code": self.code.value,
            "title": self.title,
            "message": self.user_message,
            "detail": self.detail,
            "suggested_action": self.suggested_action
        }


def map_exception_to_ai_error(e: Exception) -> AIError:
    """Map common exceptions to AIError"""
    error_str = str(e).lower()
    
    # OpenAI errors
    if "authentication" in error_str or "api key" in error_str:
        return AIError(AIErrorCode.API_KEY_INVALID, str(e))
    if "rate limit" in error_str or "rate_limit" in error_str:
        return AIError(AIErrorCode.RATE_LIMITED, str(e))
    if "timeout" in error_str:
        return AIError(AIErrorCode.TIMEOUT, str(e))
    if "model" in error_str and ("not found" in error_str or "does not exist" in error_str):
        return AIError(AIErrorCode.MODEL_NOT_FOUND, str(e))
    if "connection" in error_str:
        return AIError(AIErrorCode.CONNECTION_FAILED, str(e))
    if "network" in error_str:
        return AIError(AIErrorCode.NETWORK_ERROR, str(e))
    
    # Ollama errors
    if "ollama" in error_str and ("not running" in error_str or "connection refused" in error_str):
        return AIError(AIErrorCode.CONNECTION_FAILED, str(e))
    
    return AIError(AIErrorCode.UNKNOWN_ERROR, str(e))
