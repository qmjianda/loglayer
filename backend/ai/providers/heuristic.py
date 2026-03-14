from typing import Optional
import re
from datetime import datetime
from .base import BaseAIProvider
from ..config import (
    ChatMessage,
    ChatResponse,
    TimestampDetectionResult,
    TimeRangeSuggestion,
)


TIMESTAMP_PATTERNS = [
    (
        r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)",
        "%Y-%m-%dT%H:%M:%S",
        "ISO8601",
    ),
    (
        r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)",
        "%Y-%m-%d %H:%M:%S",
        "Standard",
    ),
    (r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})", "%m/%d/%Y %H:%M:%S", "US Format"),
    (r"(\d{10,13})", None, "Unix Timestamp"),
    (r"\[(\d{2}-\w{3}-\d{4}\s+\d{2}:\d{2}:\d{2})\]", "%d-%b-%Y %H:%M:%S", "Syslog"),
]

LEVEL_PATTERNS = [
    (r"\b(FATAL|CRITICAL)\b", "FATAL"),
    (r"\b(ERROR|ERR|FAIL|FAILED)\b", "ERROR"),
    (r"\b(WARN|WARNING)\b", "WARNING"),
    (r"\b(INFO|INFORMATION)\b", "INFO"),
    (r"\b(DEBUG|DBG)\b", "DEBUG"),
    (r"\b(TRACE|TRC)\b", "TRACE"),
]


class HeuristicProvider(BaseAIProvider):
    """Offline heuristic-based AI provider for timestamp detection and basic analysis"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "heuristic",
        base_url: Optional[str] = None,
    ):
        super().__init__(api_key, model, base_url)

    def chat(self, messages: list[ChatMessage], content: str) -> ChatResponse:
        """Basic heuristic chat - returns template response"""
        return ChatResponse(
            message="I'm running in offline mode. Configure OpenAI or Ollama in Settings for AI-powered analysis.",
            suggestions=[],
        )

    def detect_timestamp(self, log_sample: str) -> Optional[TimestampDetectionResult]:
        """Detect timestamp format using regex patterns"""
        lines = log_sample.strip().split("\n")[:100]

        for pattern_regex, fmt, name in TIMESTAMP_PATTERNS:
            pattern = re.compile(pattern_regex)
            matches = []
            times = []

            for line in lines:
                match = pattern.search(line)
                if match:
                    matches.append(match.group(1))
                    if fmt:
                        try:
                            dt = datetime.strptime(match.group(1), fmt)
                            times.append(dt)
                        except ValueError:
                            pass

            if len(matches) >= 3:
                detected_format = fmt if fmt else "unix"
                detected_pattern = pattern_regex

                if times:
                    times.sort()
                    return TimestampDetectionResult(
                        pattern=detected_pattern,
                        format=detected_format,
                        start_time=times[0].strftime(detected_format),
                        end_time=times[-1].strftime(detected_format),
                    )
                return TimestampDetectionResult(
                    pattern=detected_pattern, format=detected_format
                )

        return None

    def suggest_time_range(self, log_sample: str) -> list[TimeRangeSuggestion]:
        """Suggest time ranges based on error density"""
        suggestions = []

        pattern_regex, fmt, _ = TIMESTAMP_PATTERNS[1]
        pattern = re.compile(pattern_regex)

        lines = log_sample.strip().split("\n")
        time_buckets = {}

        for line in lines[:10000]:
            match = pattern.search(line)
            if match and fmt:
                try:
                    dt = datetime.strptime(match.group(1), fmt)
                    hour_key = dt.hour

                    has_error = any(
                        re.search(p, line, re.IGNORECASE) for p, _ in LEVEL_PATTERNS[:2]
                    )
                    has_warn = any(
                        re.search(p, line, re.IGNORECASE)
                        for p, _ in LEVEL_PATTERNS[2:3]
                    )

                    if hour_key not in time_buckets:
                        time_buckets[hour_key] = {
                            "total": 0,
                            "errors": 0,
                            "warnings": 0,
                        }
                    time_buckets[hour_key]["total"] += 1
                    if has_error:
                        time_buckets[hour_key]["errors"] += 1
                    if has_warn:
                        time_buckets[hour_key]["warnings"] += 1
                except ValueError:
                    pass

        if time_buckets:
            max_errors = (
                max(b["errors"] for b in time_buckets.values()) if time_buckets else 0
            )
            if max_errors > 0:
                error_hours = [
                    h for h, b in time_buckets.items() if b["errors"] == max_errors
                ]
                if error_hours and fmt:
                    hour = error_hours[0]
                    start_time = f"{hour:02d}:00:00"
                    end_time = f"{hour:02d}:59:59"
                    suggestions.append(
                        TimeRangeSuggestion(
                            start=start_time,
                            end=end_time,
                            description=f"High error activity: {max_errors} errors at {hour}:00",
                            reason="error_density",
                        )
                    )

        return suggestions[:5]

    def is_available(self) -> bool:
        """Heuristic is always available"""
        return True

    def list_models(self) -> list[str]:
        """No models for heuristic"""
        return ["heuristic"]

    def is_offline(self) -> bool:
        """Heuristic provider works offline (no network required)"""
        return True
