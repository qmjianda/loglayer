import psutil
import re
from loglayer.core import TransformLayer, Widget, ProcessedLine
from loglayer.ui import SearchInput


class AnonymizerLayer(TransformLayer):
    display_name = "Anonymizer"
    description = "Mask sensitive data (demonstrating Python logic layer)"
    icon = "transform"

    inputs = [
        SearchInput(
            "pattern", "Pattern to Mask", value=r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", regex=True
        )
    ]

    def process_line(self, content: str) -> ProcessedLine:
        pattern = self.config.get("pattern", r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}")
        masked = re.sub(pattern, "[MASKED]", content)
        return ProcessedLine(content=masked)


class SystemStatsWidget(Widget):
    """
    系统状态挂件示例。
    在状态栏显示 CPU 和内存占用。
    """

    display_name = "System Stats"
    role = "statusbar"
    refresh_interval = 2.0

    def get_data(self) -> dict:
        cpu = psutil.cpu_percent()
        mem = psutil.virtual_memory().percent
        return {
            "text": f"CPU: {cpu}% | MEM: {mem}%",
            "color": "rgb(59, 130, 246)" if cpu < 70 else "rgb(239, 68, 68)",
            "tooltip": f"System resources usage\nCPU: {cpu}%\nMemory: {mem}%",
        }
