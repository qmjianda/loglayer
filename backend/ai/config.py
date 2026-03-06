from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class AIProvider(str, Enum):
    HEURISTIC = "heuristic"
    OPENAI = "openai"
    OLLAMA = "ollama"


class AIConfig(BaseModel):
    provider: AIProvider = AIProvider.HEURISTIC
    api_key: Optional[str] = None
    model: str = "gpt-4o-mini"
    base_url: Optional[str] = None

    class Config:
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
    messages: List[ChatMessage]
    content: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    suggestions: List[dict] = []
