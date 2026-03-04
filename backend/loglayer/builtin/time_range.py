"""
Time Range Filter Layer - 时间范围过滤层
支持按时间范围过滤日志，自动检测常见时间戳格式
"""
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple, List
from loglayer.ui import StrInput, DropdownInput, BoolInput
from loglayer.core import FilterLayer, LayerStage


# 常见时间戳格式
TIMESTAMP_PATTERNS = [
    # ISO 8601: 2024-01-15T10:30:45.123Z
    (r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)', '%Y-%m-%dT%H:%M:%S'),
    # Standard: 2024-01-15 10:30:45.123
    (r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)', '%Y-%m-%d %H:%M:%S'),
    # US format: 01/15/2024 10:30:45
    (r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})', '%m/%d/%Y %H:%M:%S'),
    # Log4j: 2024-01-15 10:30:45,123
    (r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})', '%Y-%m-%d %H:%M:%S,%f'),
    # Simple: 10:30:45
    (r'(\d{2}:\d{2}:\d{2})', '%H:%M:%S'),
    # Unix timestamp: 1705312245
    (r'^.*?(\d{10})(?:\d{3})?', 'unix'),
]


class TimeRangeFilterLayer(FilterLayer):
    """
    时间范围过滤层
    根据时间戳过滤日志行
    """
    display_name = "时间范围过滤"
    description = "按时间范围过滤日志"
    icon = "clock"
    stage = LayerStage.LOGIC
    
    inputs = [
        StrInput("start_time", "开始时间 (ISO 格式)", value="2024-01-01T00:00:00"),
        StrInput("end_time", "结束时间 (ISO 格式)", value="2024-12-31T23:59:59"),
        DropdownInput("time_format", "时间格式", options=[
            {"value": "auto", "label": "自动检测"},
            {"value": "iso", "label": "ISO 8601"},
            {"value": "standard", "label": "标准格式"},
            {"value": "unix", "label": "Unix 时间戳"},
        ], value="auto"),
        BoolInput("exclude_outside_range", "排除范围外的日志", value=True),
    ]
    
    def __init__(self, config=None):
        super().__init__(config)
        self.start_time: Optional[datetime] = None
        self.end_time: Optional[datetime] = None
        self._compiled_patterns: List[Tuple[re.Pattern, str]] = []
        
        self._parse_time_config()
        self._compile_patterns()
    
    def _parse_time_config(self):
        """解析时间配置"""
        if self.start_time:
            try:
                if isinstance(self.start_time, str):
                    self.start_time = self._parse_datetime(self.start_time)
            except Exception as e:
                print(f"[TimeRangeFilter] Invalid start_time: {e}")
                self.start_time = None
        
        if self.end_time:
            try:
                if isinstance(self.end_time, str):
                    self.end_time = self._parse_datetime(self.end_time)
            except Exception as e:
                print(f"[TimeRangeFilter] Invalid end_time: {e}")
                self.end_time = None
    
    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """解析日期时间字符串"""
        if not dt_str:
            return None
        
        # 尝试常见格式
        formats = [
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M:%S.%f',
            '%Y-%m-%d',
            '%m/%d/%Y %H:%M:%S',
            '%m/%d/%Y',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        # 尝试 Unix 时间戳
        try:
            timestamp = float(dt_str)
            if timestamp > 1e12:  # 毫秒
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp)
        except (ValueError, OSError):
            pass
        
        return None
    
    def _compile_patterns(self):
        """编译时间戳匹配正则"""
        self._compiled_patterns = []
        for pattern, fmt in TIMESTAMP_PATTERNS:
            try:
                self._compiled_patterns.append((re.compile(pattern), fmt))
            except re.error:
                pass
    
    def _extract_timestamp(self, line: str) -> Optional[datetime]:
        """从日志行中提取时间戳"""
        for pattern, fmt in self._compiled_patterns:
            match = pattern.search(line)
            if match:
                ts_str = match.group(1)
                
                if fmt == 'unix':
                    try:
                        timestamp = int(ts_str)
                        if timestamp > 1e12:
                            timestamp /= 1000
                        return datetime.fromtimestamp(timestamp)
                    except (ValueError, OSError):
                        continue
                
                # 尝试解析时间
                # 处理毫秒部分
                if '.' in ts_str and '%f' not in fmt:
                    fmt_with_ms = fmt.replace('%S', '%S.%f')
                    try:
                        return datetime.strptime(ts_str, fmt_with_ms)
                    except ValueError:
                        pass
                
                try:
                    return datetime.strptime(ts_str, fmt)
                except ValueError:
                    # 尝试不带毫秒的格式
                    if '.' in ts_str:
                        ts_no_ms = ts_str.split('.')[0]
                        fmt_no_ms = fmt.replace('.%f', '').replace(',%f', '')
                        try:
                            return datetime.strptime(ts_no_ms, fmt_no_ms)
                        except ValueError:
                            pass
        
        return None
    
    def filter_line(self, content: str, index: int = -1) -> bool:
        """
        过滤日志行
        
        Returns:
            True: 保留该行
            False: 过滤掉该行
        """
        # 如果没有设置时间范围，保留所有行
        if not self.start_time and not self.end_time:
            return True
        
        # 提取时间戳
        timestamp = self._extract_timestamp(content)
        
        # 如果没有找到时间戳
        if timestamp is None:
            # 如果设置为排除范围外的日志，则过滤掉
            return not getattr(self, 'exclude_outside_range', True)
        
        # 检查时间范围
        if self.start_time and timestamp < self.start_time:
            return False
        
        if self.end_time and timestamp > self.end_time:
            return False
        
        return True
    
    def reset(self):
        """重置图层状态"""
        pass
    
    def get_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        """获取当前时间范围"""
        return self.start_time, self.end_time
    
    def set_time_range(self, start: Optional[str], end: Optional[str]):
        """设置时间范围"""
        self.start_time = self._parse_datetime(start) if start else None
        self.end_time = self._parse_datetime(end) if end else None


class RelativeTimeFilterLayer(FilterLayer):
    """
    相对时间过滤层
    过滤最近 N 小时/分钟/天的日志
    """
    display_name = "相对时间过滤"
    description = "过滤最近 N 小时/分钟/天的日志"
    icon = "history"
    stage = LayerStage.LOGIC
    
    inputs = [
        DropdownInput("unit", "时间单位", options=[
            {"value": "minutes", "label": "分钟"},
            {"value": "hours", "label": "小时"},
            {"value": "days", "label": "天"},
        ], value="hours"),
        StrInput("value", "数值", value="1"),
        BoolInput("exclude_older", "排除更早的日志", value=True),
    ]
    
    def __init__(self, config=None):
        super().__init__(config)
        self.cutoff_time: Optional[datetime] = None
        self._calculate_cutoff()
    
    def _calculate_cutoff(self):
        """计算截止时间"""
        try:
            value = float(getattr(self, 'value', 1))
            unit = getattr(self, 'unit', 'hours')
            
            now = datetime.now()
            
            if unit == 'minutes':
                self.cutoff_time = now - timedelta(minutes=value)
            elif unit == 'hours':
                self.cutoff_time = now - timedelta(hours=value)
            elif unit == 'days':
                self.cutoff_time = now - timedelta(days=value)
            else:
                self.cutoff_time = now - timedelta(hours=1)
        except Exception as e:
            print(f"[RelativeTimeFilter] Error calculating cutoff: {e}")
            self.cutoff_time = datetime.now() - timedelta(hours=1)
    
    def _extract_timestamp(self, line: str) -> Optional[datetime]:
        """从日志行中提取时间戳（复用 TimeRangeFilterLayer 的逻辑）"""
        for pattern, fmt in TIMESTAMP_PATTERNS:
            match = re.search(pattern, line)
            if match:
                ts_str = match.group(1)
                
                if fmt == 'unix':
                    try:
                        timestamp = int(ts_str)
                        if timestamp > 1e12:
                            timestamp /= 1000
                        return datetime.fromtimestamp(timestamp)
                    except (ValueError, OSError):
                        continue
                
                try:
                    return datetime.strptime(ts_str, fmt)
                except ValueError:
                    if '.' in ts_str:
                        ts_no_ms = ts_str.split('.')[0]
                        fmt_no_ms = fmt.replace('.%f', '').replace(',%f', '')
                        try:
                            return datetime.strptime(ts_no_ms, fmt_no_ms)
                        except ValueError:
                            pass
        
        return None
    
    def filter_line(self, content: str, index: int = -1) -> bool:
        """过滤日志行"""
        if not self.cutoff_time:
            return True
        
        timestamp = self._extract_timestamp(content)
        
        if timestamp is None:
            return not getattr(self, 'exclude_older', True)
        
        # 检查是否在时间范围内（最近 N 时间单位）
        return timestamp >= self.cutoff_time
    
    def reset(self):
        """重置图层状态"""
        self._calculate_cutoff()
