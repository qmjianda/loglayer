from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AIProvider(str, Enum):
    NONE = "none"
    OPENAI = "openai"
    OLLAMA = "ollama"


class AIConfig(BaseModel):
    provider: AIProvider = AIProvider.NONE
    apiKey: Optional[str] = Field(default=None, alias="api_key")
    model: str = "gpt-4o-mini"
    baseUrl: Optional[str] = Field(default=None, alias="base_url")

    class Config:
        populate_by_name = True
        use_enum_values = True


class TimestampDetectionResult(BaseModel):
    pattern: str
    format: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class TimeRangeSuggestion(BaseModel):
    start: str
    end: str
    description: str
    reason: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    content: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    suggestions: list[dict] = []
