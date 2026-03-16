
from loglayer.core import FilterLayer
from loglayer.ui import IntInput

class RangeLayer(FilterLayer):
    """范围图层：显示指定行号范围内的内容"""
    type_id = "RANGE"
    display_name = "范围图层"
    description = "显示指定行号范围内的内容"
    icon = "split"

    inputs = [
        IntInput("start", "开始行号", value=1, info="起始行（包含）"),
        IntInput("end", "结束行号", value=100, info="结束行（包含）"),
    ]

    def __init__(self, config=None):
        super().__init__(config)
        # Ensure values are integers/defaults
        try:
            self.start_line = int(self.config.get("start", 1))
        except:
            self.start_line = 1
            
        try:
            self.end_line = int(self.config.get("end", 100))
        except:
            self.end_line = 100

    def filter_line(self, content: str, index: int = -1) -> bool:
        # Use provided index (1-based for user input), fallback to counting
        line_num = index + 1 if index >= 0 else 1
        return self.start_line <= line_num <= self.end_line
