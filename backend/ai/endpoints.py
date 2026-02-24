from fastapi import APIRouter, HTTPException
from typing import Optional
from .config import (
    ChatRequest,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
    AIProvider,
    AIConfig,
)
from .service import get_ai_service


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send chat message to AI"""
    service = get_ai_service()
    return service.chat(request.messages, request.content or "")


@router.post("/detect-timestamp", response_model=TimestampDetectionResult)
async def detect_timestamp(sample: dict):
    """Detect timestamp format from log sample"""
    service = get_ai_service()
    log_sample = sample.get("content", "")

    if not log_sample:
        raise HTTPException(status_code=400, detail="No content provided")

    result = service.detect_timestamp(log_sample)
    if result is None:
        raise HTTPException(status_code=404, detail="Could not detect timestamp format")

    return result


@router.post("/suggest-time-range", response_model=list[TimeRangeSuggestion])
async def suggest_time_range(sample: dict):
    """Suggest time ranges from log sample"""
    service = get_ai_service()
    log_sample = sample.get("content", "")

    if not log_sample:
        raise HTTPException(status_code=400, detail="No content provided")

    return service.suggest_time_range(log_sample)


@router.get("/models")
async def list_models():
    """List available AI models"""
    service = get_ai_service()
    return {"models": service.list_models()}


@router.get("/config")
async def get_config():
    """Get current AI configuration"""
    service = get_ai_service()
    config = service.get_config()
    return {
        "provider": config.provider,
        "model": config.model,
        "isConnected": service.is_connected(),
    }


@router.post("/config")
async def update_config(config: AIConfig):
    """Update AI configuration"""
    service = get_ai_service()
    service.update_config(config)
    return {"status": "updated"}


@router.post("/test-connection")
async def test_connection():
    """Test AI connection"""
    service = get_ai_service()
    connected, message = service.test_connection()
    return {"connected": connected, "message": message}
