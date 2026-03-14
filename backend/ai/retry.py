"""Retry utility for API calls"""

import time
import functools
from typing import Callable, TypeVar, Optional
from .errors import AIError, AIErrorCode


T = TypeVar('T')


def retry_with_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 10.0,
    backoff_factor: float = 2.0,
    retryable_errors: Optional[tuple] = None
) -> Callable:
    """Decorator for retrying API calls with exponential backoff"""
    
    if retryable_errors is None:
        retryable_errors = (ConnectionError, TimeoutError, Exception)
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None
            delay = initial_delay
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except AIError as e:
                    # Don't retry on certain AI errors
                    if e.code in [
                        AIErrorCode.API_KEY_INVALID,
                        AIErrorCode.MODEL_NOT_FOUND,
                        AIErrorCode.NO_CONTENT
                    ]:
                        raise
                    last_exception = e
                except retryable_errors as e:
                    last_exception = e
                
                # Don't sleep after the last attempt
                if attempt < max_retries:
                    time.sleep(min(delay, max_delay))
                    delay *= backoff_factor
            
            # All retries exhausted
            raise AIError(
                AIErrorCode.CONNECTION_FAILED,
                f"Failed after {max_retries + 1} attempts: {str(last_exception)}"
            )
        
        return wrapper
    return decorator


def retry_api_call(func: Callable[..., T]) -> Callable[..., T]:
    """Default retry decorator for API calls (3 retries, 1s initial delay)"""
    return retry_with_backoff(max_retries=3, initial_delay=1.0)(func)
