
from loglayer.ui import MultiSelectInput, DropdownInput
from loglayer.core import NativeProcessingLayer

# Common log level preset configurations
LEVEL_PRESETS = {
    "all": ["INFO", "WARN", "ERROR", "DEBUG", "FATAL", "TRACE"],
    "errors_only": ["ERROR", "FATAL"],
    "warnings_and_above": ["WARN", "ERROR", "FATAL"],
    "production": ["WARN", "ERROR", "FATAL"],
    "development": ["INFO", "WARN", "ERROR", "DEBUG", "FATAL", "TRACE"],
    "quiet": ["ERROR", "FATAL"],
}

class LevelLayer(NativeProcessingLayer):
    """等级图层：按日志等级进行过滤
    
    支持多种日志等级过滤，包括预设模式（如仅错误、生产环境等）
    使用 ripgrep 进行高性能原生过滤
    """
    display_name = "等级图层"
    description = "按日志等级进行过滤 (支持预设模式)"
    icon = "level"
    
    inputs = [
        DropdownInput("preset", "预设模式", options=[
            "custom",
            "errors_only",
            "warnings_and_above",
            "production",
            "development",
            "quiet"
        ], value="custom"),
        MultiSelectInput("levels", "选择等级", options=["INFO", "WARN", "ERROR", "DEBUG", "FATAL", "TRACE"], value=["INFO", "WARN", "ERROR", "DEBUG", "FATAL"])
    ]

    def get_rg_args(self) -> list:
        # Use preset if selected
        if hasattr(self, 'preset') and self.preset and self.preset != "custom":
            levels = LEVEL_PRESETS.get(self.preset, self.levels or [])
        else:
            levels = self.levels or []
        
        if not levels: 
            return ["-v", ".*"]  # Hide all if none selected
        
        # Combine levels into an OR regex (case-insensitive)
        pattern = "|".join(sorted(levels, key=len, reverse=True))  # Sort by length to avoid partial matches
        return ["-i", "-e", pattern]
    
    def get_display_summary(self) -> str:
        """返回人类可读的过滤描述"""
        if hasattr(self, 'preset') and self.preset and self.preset != "custom":
            preset_names = {
                "errors_only": "仅错误",
                "warnings_and_above": "警告及以上",
                "production": "生产环境",
                "development": "开发环境",
                "quiet": "静默模式"
            }
            return f"预设：{preset_names.get(self.preset, self.preset)}"
        
        if not self.levels:
            return "无过滤"
        return f"等级：{', '.join(self.levels)}"
