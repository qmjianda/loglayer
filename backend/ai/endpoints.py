from fastapi import APIRouter, HTTPException
import traceback
from .config import (
    ChatRequest,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
    AIConfig,
)
from .service import get_ai_service
from .errors import AIError, AIErrorCode, map_exception_to_ai_error


router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send chat message to AI"""
    try:
        service = get_ai_service()
        
        if not service.is_configured():
            raise AIError(AIErrorCode.CONFIG_NOT_SET)
        
        return service.chat(request.messages, request.content or "")
    except AIError:
        raise
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        raise HTTPException(
            status_code=500,
            detail=ai_error.to_dict()
        )


@router.post("/detect-timestamp", response_model=TimestampDetectionResult)
async def detect_timestamp(sample: dict):
    """Detect timestamp format from log sample"""
    try:
        service = get_ai_service()
        log_sample = sample.get("content", "")

        if not log_sample:
            raise AIError(AIErrorCode.NO_CONTENT)

        result = service.detect_timestamp(log_sample)
        if result is None:
            raise AIError(AIErrorCode.TIMESTAMP_NOT_DETECTED)

        return result
    except AIError as e:
        raise HTTPException(status_code=400, detail=e.to_dict())
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        raise HTTPException(status_code=500, detail=ai_error.to_dict())


@router.post("/suggest-time-range", response_model=list[TimeRangeSuggestion])
async def suggest_time_range(sample: dict):
    """Suggest time ranges from log sample"""
    try:
        service = get_ai_service()
        log_sample = sample.get("content", "")

        if not log_sample:
            raise AIError(AIErrorCode.NO_CONTENT)

        return service.suggest_time_range(log_sample)
    except AIError as e:
        raise HTTPException(status_code=400, detail=e.to_dict())
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        raise HTTPException(status_code=500, detail=ai_error.to_dict())


@router.get("/models")
async def list_models():
    """List available AI models"""
    try:
        service = get_ai_service()
        return {"models": service.list_models()}
    except AIError as e:
        raise HTTPException(status_code=400, detail=e.to_dict())
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        raise HTTPException(status_code=500, detail=ai_error.to_dict())


@router.get("/config")
async def get_config():
    """Get current AI configuration"""
    try:
        service = get_ai_service()
        config = service.get_config()
        return {
            "provider": config.provider,
            "model": config.model,
            "baseUrl": config.base_url,
            "isConnected": service.is_connected(),
            "isConfigured": service.is_configured(),
        }
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        raise HTTPException(status_code=500, detail=ai_error.to_dict())


@router.post("/config")
async def update_config(config: AIConfig):
    """Update AI configuration"""
    try:
        service = get_ai_service()
        service.update_config(config)
        return {"status": "updated"}
    except AIError as e:
        raise HTTPException(status_code=400, detail=e.to_dict())
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        raise HTTPException(status_code=500, detail=ai_error.to_dict())


@router.post("/test-connection")
async def test_connection():
    """Test AI connection"""
    try:
        service = get_ai_service()
        
        if not service.is_configured():
            return {
                "connected": False,
                "message": "AI 未配置，请先前往设置面板配置",
                "error": AIError(AIErrorCode.CONFIG_NOT_SET).to_dict()
            }
        
        connected, message = service.test_connection()
        return {"connected": connected, "message": message}
    except Exception as e:
        traceback.print_exc()
        ai_error = map_exception_to_ai_error(e)
        return {
            "connected": False,
            "message": ai_error.user_message,
            "error": ai_error.to_dict()
        }
