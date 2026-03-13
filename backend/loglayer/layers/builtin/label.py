"""
Label Extraction Layer - Loki-inspired Label-based Filtering

Automatically extracts key-value pairs from log lines as labels.
Supports filtering by label values, similar to Loki's label system.

Features:
- Auto-detect common label patterns (key=value, key:value, "key": "value")
- Support for nested JSON-like structures
- Label-based filtering with exact match and regex
- Performance-optimized with cached patterns

Examples:
- Extract: level=ERROR, service=api, user_id=123
- Filter: {level="ERROR", service=~"api.*"}
"""

import re
import json
from typing import Dict, List, Optional, Any, Tuple
from loglayer.core import FilterLayer, TransformLayer, LayerCategory, LayerStage
from loglayer.ui import StrInput, BoolInput, DropdownInput


# Common label patterns
LABEL_PATTERNS = [
    # JSON format: "key": "value" or "key": value
    (r'"(\w+)"\s*:\s*"([^"]*)"', 'json_string'),
    (r'"(\w+)"\s*:\s*(\d+(?:\.\d+)?)', 'json_number'),
    (r'"(\w+)"\s*:\s*(true|false)', 'json_bool'),
    
    # Key=value format
    (r'\b(\w+)=(\S+)', 'equals'),
    
    # Key:value format (common in logs)
    (r'\b(\w+):(\S+)', 'colon'),
    
    # Bracket format: [key=value]
    (r'\[(\w+)=([^\]]+)\]', 'bracket'),
    
    # Angle bracket format: <key=value>
    (r'<(\w+)=([^>]+)>', 'angle'),
]


class LabelExtractor:
    """
    Extract labels from log lines.
    
    Identifies key-value pairs using multiple pattern matching strategies.
    
    Performance: Compiled patterns are shared across all instances as class-level constants.
    """
    
    # Class-level compiled patterns (shared across all instances)
    _COMPILED_PATTERNS: List[Tuple[re.Pattern, str]] = []
    
    @classmethod
    def _init_patterns(cls):
        """Initialize compiled patterns once (called on first use)."""
        if not cls._COMPILED_PATTERNS:
            for pattern, ptype in LABEL_PATTERNS:
                try:
                    cls._COMPILED_PATTERNS.append((re.compile(pattern), ptype))
                except re.error:
                    pass
    
    def __init__(self):
        # Ensure patterns are compiled (only once, class-level)
        if not self._COMPILED_PATTERNS:
            self._init_patterns()
    
    def extract(self, line: str) -> Dict[str, str]:
        """
        Extract all labels from a log line.
        
        Args:
            line: Log line content
            
        Returns:
            Dictionary of label key-value pairs
        """
        labels = {}
        
        # Try JSON parsing first (for structured logs)
        if line.strip().startswith('{'):
            try:
                # Try to find JSON object in line
                match = re.search(r'\{[^{}]*\}', line)
                if match:
                    data = json.loads(match.group())
                    for key, value in data.items():
                        if isinstance(value, (str, int, float, bool)):
                            labels[str(key)] = str(value).lower() if isinstance(value, bool) else str(value)
            except (json.JSONDecodeError, ValueError):
                pass
        
        # Apply pattern matching (using class-level compiled patterns)
        for pattern, ptype in self._COMPILED_PATTERNS:
            for match in pattern.finditer(line):
                key = match.group(1).lower()  # Normalize key to lowercase
                value = match.group(2)
                
                # Skip if key is already found (first match wins)
                if key not in labels:
                    labels[key] = value
        
        return labels
    
    def extract_for_field(self, line: str, field: str) -> Optional[str]:
        """
        Extract a specific field value from a log line.
        
        Args:
            line: Log line content
            field: Field name to extract
            
        Returns:
            Field value or None if not found
        """
        field_lower = field.lower()
        
        # Try JSON first
        if line.strip().startswith('{'):
            try:
                match = re.search(r'\{[^{}]*\}', line)
                if match:
                    data = json.loads(match.group())
                    if field in data:
                        return str(data[field])
                    # Case-insensitive search
                    for key, value in data.items():
                        if key.lower() == field_lower:
                            return str(value)
            except (json.JSONDecodeError, ValueError):
                pass
        
        # Try pattern matching (using class-level compiled patterns)
        for pattern, ptype in self._COMPILED_PATTERNS:
            for match in pattern.finditer(line):
                key = match.group(1).lower()
                if key == field_lower:
                    return match.group(2)
        
        return None


class LabelLayer(FilterLayer):
    """
    Label-based filtering layer.
    
    Filters logs based on extracted labels.
    Supports exact match and regex matching.
    """
    
    type_id = "LABEL"
    display_name = "标签过滤"
    description = "基于自动提取的标签进行过滤 (类似 Loki)"
    icon = "tag"
    category = LayerCategory.FILTER
    stage = LayerStage.LOGIC
    
    inputs = [
        StrInput("labels", "标签过滤器", 
                 info="格式：key=value 或 key=~regex，多个用 AND 连接",
                 placeholder="level=ERROR AND service=~api.*"),
        BoolInput("case_sensitive", "区分大小写", value=False),
        DropdownInput("match_mode", "匹配模式", 
                     options=[
                         {"value": "all", "label": "所有标签匹配 (AND)"},
                         {"value": "any", "label": "任一标签匹配 (OR)"},
                     ],
                     value="all"),
    ]
    
    def __init__(self, config=None):
        super().__init__(config)
        self.extractor = LabelExtractor()
        self._parsed_filters = []
        self._parse_filters()
    
    def _parse_filters(self):
        """Parse label filter string into structured filters."""
        if not hasattr(self, 'labels') or not self.labels:
            self._parsed_filters = []
            return
        
        self._parsed_filters = []
        filters_str = self.labels
        
        # Split by AND/OR
        # Simple parsing: split by AND first
        and_parts = re.split(r'\s+AND\s+', filters_str, flags=re.IGNORECASE)
        
        for part in and_parts:
            part = part.strip()
            if not part:
                continue
            
            # Check for OR within this part
            or_parts = re.split(r'\s+OR\s+', part, flags=re.IGNORECASE)
            
            for filter_str in or_parts:
                filter_str = filter_str.strip()
                if not filter_str:
                    continue
                
                # Parse key=value or key=~regex
                if '=~' in filter_str:
                    key, pattern = filter_str.split('=~', 1)
                    self._parsed_filters.append({
                        'type': 'regex',
                        'key': key.strip().lower(),
                        'pattern': pattern.strip(),
                        'operator': 'or' if ' OR ' in part else 'and'
                    })
                elif '=' in filter_str:
                    key, value = filter_str.split('=', 1)
                    self._parsed_filters.append({
                        'type': 'exact',
                        'key': key.strip().lower(),
                        'value': value.strip(),
                        'operator': 'or' if ' OR ' in part else 'and'
                    })
    
    def filter_line(self, content: str, index: int = -1) -> bool:
        """Filter line based on labels."""
        if not self._parsed_filters:
            return True
        
        # Extract labels from line
        labels = self.extractor.extract(content)
        
        # Evaluate filters
        results = []
        current_op = 'and'
        
        for f in self._parsed_filters:
            key = f['key']
            label_value = labels.get(key)
            
            if label_value is None:
                match = False
            elif f['type'] == 'regex':
                try:
                    pattern = re.compile(f['pattern'], re.IGNORECASE if not getattr(self, 'case_sensitive', False) else 0)
                    match = bool(pattern.search(label_value))
                except re.error:
                    match = False
            else:  # exact match
                if getattr(self, 'case_sensitive', False):
                    match = label_value == f['value']
                else:
                    match = label_value.lower() == f['value'].lower()
            
            results.append((match, f['operator']))
        
        # Combine results
        if not results:
            return True
        
        # Group by operator
        and_matches = []
        or_matches = []
        
        for match, op in results:
            if op == 'or':
                or_matches.append(match)
            else:
                and_matches.append(match)
        
        # All AND conditions must match
        and_result = all(and_matches) if and_matches else True
        
        # At least one OR condition must match
        or_result = any(or_matches) if or_matches else True
        
        return and_result and or_result
    
    def reset(self):
        """Reset when config changes."""
        self._parse_filters()
    
    def get_extracted_labels(self, content: str) -> Dict[str, str]:
        """Get extracted labels for a log line (for UI display)."""
        return self.extractor.extract(content)


class LabelTransformLayer(TransformLayer):
    """
    Label annotation layer.
    
    Adds extracted labels as metadata to log lines for UI display.
    """
    type_id = "LABEL_TRANSFORM"
    display_name = "标签标注"
    description = "提取并标注日志标签 (用于 UI 显示)"
    icon = "tag"
    category = LayerCategory.TRANSFORM
    stage = LayerStage.LOGIC
    
    inputs = [
        BoolInput("include_all", "包含所有标签", value=True),
        StrInput("specific_labels", "特定标签 (逗号分隔)", 
                 info="留空则包含所有标签",
                 placeholder="level,service,user_id"),
    ]
    
    def __init__(self, config=None):
        super().__init__(config)
        self.extractor = LabelExtractor()
    
    def process_line(self, content: str) -> Any:
        """Extract labels and add to line metadata."""
        from loglayer.core import ProcessedLine
        
        labels = self.extractor.extract(content)
        
        # Filter labels if specific ones requested
        if hasattr(self, 'specific_labels') and self.specific_labels:
            specific = [s.strip().lower() for s in self.specific_labels.split(',')]
            labels = {k: v for k, v in labels.items() if k in specific}
        
        # Add labels as JSON comment at end (for display)
        if labels:
            labels_json = json.dumps(labels, ensure_ascii=False)
            return ProcessedLine(
                content=content,
                offset_map=None,
                metadata={'labels': labels, 'labels_json': labels_json}
            )
        
        return ProcessedLine(content=content)
