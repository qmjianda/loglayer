"""
Log Pattern Detection Utilities

Inspired by ELK Stack and Loki's label-based approach, this module provides
automatic log pattern detection and categorization.

Features:
- Timestamp format auto-detection (ISO8601, Unix, common formats)
- Log level auto-detection
- Common log format recognition (Apache, Nginx, application logs)
- Pattern-based categorization for efficient filtering
"""

import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any


# Comprehensive timestamp patterns
TIMESTAMP_PATTERNS = [
    # ISO8601 formats
    (r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)', '%Y-%m-%dT%H:%M:%S', 'ISO8601'),
    (r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)', '%Y-%m-%d %H:%M:%S', 'ISO8601 Space'),
    
    # Common log formats
    (r'(\d{2}/\w{3}/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})', '%d/%b/%Y:%H:%M:%S %z', 'Apache/Nginx'),
    (r'(\w{3} \d{1,2} \d{2}:\d{2}:\d{2})', '%b %d %H:%M:%S', 'Syslog'),
    
    # Unix timestamps
    (r'^(\d{10})(?:\.\d+)?\b', 'UNIX', 'Unix Timestamp'),
    (r'^(\d{13})\b', 'UNIX_MS', 'Unix Timestamp (ms)'),
    
    # Other common formats
    (r'(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})', '%Y/%m/%d %H:%M:%S', 'Slash Date'),
    (r'(\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})', '%m-%d-%Y %H:%M:%S', 'US Date'),
    (r'(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2})', '%d.%m.%Y %H:%M:%S', 'EU Date'),
]

# Log level patterns (case-insensitive)
LOG_LEVEL_PATTERNS = {
    'FATAL': r'\b(FATAL|CRITICAL|CRIT)\b',
    'ERROR': r'\b(ERROR|ERR|SEVERE)\b',
    'WARN': r'\b(WARN|WARNING)\b',
    'INFO': r'\b(INFO|NOTICE)\b',
    'DEBUG': r'\b(DEBUG|FINE)\b',
    'TRACE': r'\b(TRACE|FINER|FINEST)\b',
}

# Common log format signatures
LOG_FORMAT_SIGNATURES = {
    'apache_combined': r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+|-) "([^"]*)" "([^"]*)"',
    'apache_common': r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+|-)',
    'nginx': r'^(\S+) - (\S+) \[([^\]]+)\] "([^"]*)" (\d+) (\d+) "([^"]*)" "([^"]*)"',
    'json_log': r'^\s*\{.*\}\s*$',
    'syslog': r'^\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\S+',
    'java_stacktrace': r'^\s*at\s+[\w.$]+\(.*\)',
    'python_traceback': r'^Traceback \(most recent call last\):',
    'kubernetes': r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*\s+(INFO|WARN|ERROR|DEBUG)\s+',
}


class LogPatternDetector:
    """
    Automatic log pattern detection and categorization.
    
    Inspired by Loki's label-based approach and ELK's grok patterns.
    """
    
    def __init__(self):
        self._compiled_timestamp_patterns = [
            (re.compile(pattern), fmt, name) 
            for pattern, fmt, name in TIMESTAMP_PATTERNS
        ]
        self._compiled_level_patterns = {
            level: re.compile(pattern, re.IGNORECASE)
            for level, pattern in LOG_LEVEL_PATTERNS.items()
        }
        self._compiled_format_signatures = {
            name: re.compile(pattern)
            for name, pattern in LOG_FORMAT_SIGNATURES.items()
        }
    
    def detect_timestamp_format(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Detect timestamp format in a log line.
        
        Returns:
            Dict with 'timestamp', 'format', 'datetime' keys, or None if not found.
        """
        for pattern, fmt, name in self._compiled_timestamp_patterns:
            match = pattern.search(line)
            if match:
                ts_str = match.group(1)
                try:
                    if fmt == 'UNIX':
                        ts = datetime.fromtimestamp(int(ts_str))
                    elif fmt == 'UNIX_MS':
                        ts = datetime.fromtimestamp(int(ts_str) / 1000)
                    else:
                        ts = datetime.strptime(ts_str, fmt)
                    
                    return {
                        'timestamp': ts_str,
                        'format': fmt,
                        'format_name': name,
                        'datetime': ts,
                    }
                except (ValueError, OSError):
                    continue
        return None
    
    def detect_log_level(self, line: str) -> Optional[str]:
        """
        Detect log level in a log line.
        
        Returns:
            Log level string (FATAL, ERROR, WARN, INFO, DEBUG, TRACE) or None.
        """
        for level, pattern in self._compiled_level_patterns.items():
            if pattern.search(line):
                return level
        return None
    
    def detect_log_format(self, line: str) -> Optional[str]:
        """
        Detect the log format type.
        
        Returns:
            Format name (apache_combined, nginx, json_log, etc.) or None.
        """
        for name, pattern in self._compiled_format_signatures.items():
            if pattern.match(line):
                return name
        return None
    
    def analyze_sample(self, lines: List[str], sample_size: int = 100) -> Dict[str, Any]:
        """
        Analyze a sample of log lines to detect patterns.
        
        Args:
            lines: List of log lines to analyze
            sample_size: Maximum number of lines to analyze
            
        Returns:
            Analysis results including detected formats, levels, and patterns.
        """
        sample = lines[:sample_size]
        
        # Count patterns
        timestamp_formats: Dict[str, int] = {}
        log_levels: Dict[str, int] = {}
        log_formats: Dict[str, int] = {}
        
        for line in sample:
            # Detect timestamp
            ts_info = self.detect_timestamp_format(line)
            if ts_info:
                fmt_name = ts_info['format_name']
                timestamp_formats[fmt_name] = timestamp_formats.get(fmt_name, 0) + 1
            
            # Detect level
            level = self.detect_log_level(line)
            if level:
                log_levels[level] = log_levels.get(level, 0) + 1
            
            # Detect format
            fmt = self.detect_log_format(line)
            if fmt:
                log_formats[fmt] = log_formats.get(fmt, 0) + 1
        
        # Determine dominant patterns
        dominant_timestamp = max(timestamp_formats.items(), key=lambda x: x[1])[0] if timestamp_formats else None
        dominant_format = max(log_formats.items(), key=lambda x: x[1])[0] if log_formats else None
        
        return {
            'sample_size': len(sample),
            'timestamp_formats': timestamp_formats,
            'dominant_timestamp_format': dominant_timestamp,
            'log_levels': log_levels,
            'log_formats': log_formats,
            'dominant_log_format': dominant_format,
            'has_structured_logs': 'json_log' in log_formats,
            'has_stacktraces': 'java_stacktrace' in log_formats or 'python_traceback' in log_formats,
        }
    
    def suggest_layer_config(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """
        Suggest layer configurations based on analysis results.
        
        Args:
            analysis: Results from analyze_sample()
            
        Returns:
            Suggested layer configurations.
        """
        suggestions = []
        
        # Suggest time layer if timestamps detected
        if analysis.get('dominant_timestamp_format'):
            suggestions.append({
                'type': 'time',
                'reason': f"Detected {analysis['dominant_timestamp_format']} timestamps",
                'confidence': 'high',
            })
        
        # Suggest level layer if log levels detected
        if analysis.get('log_levels'):
            suggestions.append({
                'type': 'level',
                'reason': f"Detected log levels: {', '.join(analysis['log_levels'].keys())}",
                'confidence': 'high',
            })
        
        # Suggest format-specific layers
        if analysis.get('has_structured_logs'):
            suggestions.append({
                'type': 'json_tree',
                'reason': 'JSON logs detected - enable tree view',
                'confidence': 'high',
            })
        
        if analysis.get('has_stacktraces'):
            suggestions.append({
                'type': 'bookmark',
                'reason': 'Stacktraces detected - consider bookmarking error locations',
                'confidence': 'medium',
            })
        
        return {'suggestions': suggestions}


# Singleton instance
_detector: Optional[LogPatternDetector] = None


def get_detector() -> LogPatternDetector:
    """Get or create the singleton pattern detector instance."""
    global _detector
    if _detector is None:
        _detector = LogPatternDetector()
    return _detector


def analyze_log_sample(lines: List[str]) -> Dict[str, Any]:
    """Convenience function to analyze log sample."""
    return get_detector().analyze_sample(lines)


def suggest_layers(lines: List[str]) -> Dict[str, Any]:
    """Convenience function to analyze and suggest layers."""
    detector = get_detector()
    analysis = detector.analyze_sample(lines)
    return detector.suggest_layer_config(analysis)
