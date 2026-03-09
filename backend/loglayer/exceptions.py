"""
图层相关异常定义
"""
from typing import Any, Callable, TypeVar, Optional
from functools import wraps
import logging

logger = logging.getLogger(__name__)


# ============================================================
# 异常类定义
# ============================================================

class LayerError(Exception):
    """图层错误基类"""
    pass


class LayerConfigError(LayerError):
    """配置错误"""
    pass


class LayerExecutionError(LayerError):
    """执行错误"""
    pass


class LayerNotFoundError(LayerError):
    """图层不存在"""
    pass


# ============================================================
# 错误处理装饰器
# ============================================================

T = TypeVar("T")


def handle_layer_error(
    default_return: Any = None,
    log_level: str = "warning"
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    统一的图层错误处理装饰器
    
    Args:
        default_return: 错误时返回的默认值
        log_level: 日志级别 (debug, info, warning, error)
    
    Example:
        @handle_layer_error(default_return=[])
        def highlight_line(self, content: str) -> list:
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(self, *args, **kwargs) -> T:
            try:
                return func(self, *args, **kwargs)
            except LayerError:
                # 已知错误，重新抛出
                raise
            except Exception as e:
                log_msg = f"[{self.__class__.__name__}] {func.__name__}: {e}"
                if log_level == "debug":
                    logger.debug(log_msg)
                elif log_level == "info":
                    logger.info(log_msg)
                elif log_level == "error":
                    logger.error(log_msg)
                else:
                    logger.warning(log_msg)
                return default_return
        return wrapper
    return decorator


def validate_regex(pattern: str, flags: int = 0) -> Optional["re.Pattern"]:
    """
    验证正则表达式并返回编译后的模式
    
    Returns:
        编译后的 re.Pattern，失败返回 None
    """
    import re
    try:
        return re.compile(pattern, flags)
    except re.error:
        return None
