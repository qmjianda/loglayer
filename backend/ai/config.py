from enum import Enum
import os
import json
import base64
import logging
from typing import List, Optional
from pydantic import BaseModel, field_validator
from pathlib import Path

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logging.warning("[AI Config] cryptography not available, API keys will be stored in plaintext")


logger = logging.getLogger(__name__)


class AIProvider(str, Enum):
    HEURISTIC = "heuristic"
    OPENAI = "openai"
    OLLAMA = "ollama"
    CUSTOM = "custom"


class AIModelParams(BaseModel):
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 1.0
    top_k: int = 40
    presence_penalty: float = 0.0
    frequency_penalty: float = 0.0


def _get_encryption_key() -> Optional[bytes]:
    """Get or create encryption key for API key storage."""
    if not CRYPTO_AVAILABLE:
        return None
    
    key_file = Path.home() / ".loglayer" / ".key"
    
    if key_file.exists():
        with open(key_file, "rb") as f:
            return f.read()
    
    # Generate a new key
    key = Fernet.generate_key()
    key_file.parent.mkdir(parents=True, exist_ok=True)
    with open(key_file, "wb") as f:
        f.write(key)
    
    # Restrict permissions (only owner can read)
    os.chmod(key_file, 0o600)
    
    return key


def _encrypt_api_key(api_key: str) -> Optional[str]:
    """Encrypt API key for secure storage."""
    if not CRYPTO_AVAILABLE or not api_key:
        return api_key
    
    key = _get_encryption_key()
    if not key:
        return api_key
    
    try:
        f = Fernet(key)
        encrypted = f.encrypt(api_key.encode())
        return f"enc:{base64.b64encode(encrypted).decode()}"
    except Exception as e:
        logger.error(f"[AI Config] Encryption failed: {e}")
        return api_key


def _decrypt_api_key(encrypted_key: str) -> Optional[str]:
    """Decrypt API key from secure storage."""
    if not CRYPTO_AVAILABLE or not encrypted_key:
        return encrypted_key
    
    if not encrypted_key.startswith("enc:"):
        # Plain text key (backward compatibility)
        return encrypted_key
    
    key = _get_encryption_key()
    if not key:
        return encrypted_key
    
    try:
        f = Fernet(key)
        encrypted = base64.b64decode(encrypted_key[4:])
        return f.decrypt(encrypted).decode()
    except Exception as e:
        logger.error(f"[AI Config] Decryption failed: {e}")
        return encrypted_key


class AIConfig(BaseModel):
    provider: AIProvider = AIProvider.HEURISTIC
    api_key: Optional[str] = None
    model: str = "gpt-4o-mini"
    base_url: Optional[str] = None
    params: AIModelParams = AIModelParams()

    class Config:
        use_enum_values = True


# Config file path
CONFIG_DIR = Path.home() / ".loglayer"
CONFIG_FILE = CONFIG_DIR / "ai_config.json"


def load_ai_config() -> AIConfig:
    """Load AI config from file, return defaults if not exists"""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                # Decrypt API key if encrypted
                if data.get("api_key"):
                    data["api_key"] = _decrypt_api_key(data["api_key"])
                return AIConfig(**data)
    except (IOError, json.JSONDecodeError) as e:
        logger.warning(f"[AI Config] Load error: {e}")
    return AIConfig()


def save_ai_config(config: AIConfig) -> bool:
    """Save AI config to file with encrypted API key"""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        
        # Encrypt API key before saving
        data = config.model_dump()
        if data.get("api_key"):
            data["api_key"] = _encrypt_api_key(data["api_key"])
        
        with open(CONFIG_FILE, "w") as f:
            json.dump(data, f, indent=2)
        
        # Restrict config file permissions
        os.chmod(CONFIG_FILE, 0o600)
        
        return True
    except (IOError, OSError) as e:
        logger.error(f"[AI Config] Save error: {e}")
        return False


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
