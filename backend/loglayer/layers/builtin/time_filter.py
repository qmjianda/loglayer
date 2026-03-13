import re
from datetime import datetime
from typing import Optional

from loglayer.core import FilterLayer, LayerStage
from loglayer.ui import StrInput


TIMESTAMP_PATTERNS = [
    (r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)", "%Y-%m-%dT%H:%M:%S"),
    (r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)", "%Y-%m-%d %H:%M:%S"),
    (r"(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})", "%m/%d/%Y %H:%M:%S"),
    (r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})", "%Y-%m-%d %H:%M:%S,%f"),
    (r"(\d{2}:\d{2}:\d{2})", "%H:%M:%S"),
]

_COMPILED = [(re.compile(p), f) for p, f in TIMESTAMP_PATTERNS]


class TimeFilterLayer(FilterLayer):
    type_id = "TIME_FILTER"
    display_name = "时间过滤"
    description = "按时间戳过滤日志"
    icon = "clock"
    stage = LayerStage.LOGIC

    inputs = [
        StrInput("start", "开始时间", value="2024-01-01 00:00:00"),
        StrInput("end", "结束时间", value="2024-12-31 23:59:59"),
    ]

    def __init__(self, config=None):
        super().__init__(config)
        self.start_dt: Optional[datetime] = None
        self.end_dt: Optional[datetime] = None
        self._parse_times()

    def _parse_times(self):
        start = getattr(self, "start", None)
        end = getattr(self, "end", None)
        if start:
            try:
                self.start_dt = self._parse(start)
            except Exception:
                pass
        if end:
            try:
                self.end_dt = self._parse(end)
            except Exception:
                pass

    def _parse(self, s: str) -> datetime:
        for _, fmt in _COMPILED:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")

    def _extract(self, line: str) -> Optional[datetime]:
        for pattern, fmt in _COMPILED:
            m = pattern.search(line)
            if m:
                try:
                    ts = m.group(1)
                    if "." in ts and "%f" not in fmt:
                        ts = ts.split(".")[0]
                    return datetime.strptime(ts, fmt.replace(".%f", "").replace(",%f", ""))
                except ValueError:
                    continue
        return None

    def filter_line(self, content: str, index: int = -1) -> bool:
        if not self.start_dt and not self.end_dt:
            return True

        ts = self._extract(content)
        if not ts:
            return True

        if self.start_dt and ts < self.start_dt:
            return False
        if self.end_dt and ts > self.end_dt:
            return False
        return True
