import re


class Anonymizer:
    display_name = "Anonymizer"

    def __init__(self, config=None):
        config = config or {}
        pattern = config.get("pattern") or r"\d{1,3}(?:\.\d{1,3}){3}"
        self._regex = re.compile(pattern)

    def process_line(self, content):
        return self._regex.sub("[MASKED]", content)


def anonymize_factory(config):
    return Anonymizer(config)


def system_stats_data():
    try:
        import psutil

        cpu = psutil.cpu_percent()
        mem = psutil.virtual_memory().percent
        return {
            "text": f"CPU: {cpu}% | MEM: {mem}%",
            "color": "rgb(59, 130, 246)" if cpu < 70 else "rgb(239, 68, 68)",
            "tooltip": f"System resources usage\nCPU: {cpu}%\nMemory: {mem}%",
        }
    except Exception:
        return {}


class Plugin:
    def register(self, registry, manifest):
        registry.register_layer("anonymize", "TRANSFORM", "logic", anonymize_factory)
        registry.register_widget(
            "system-stats",
            slot="statusbar",
            renderer_id="builtin.metric",
            data_provider=system_stats_data,
        )


plugin = Plugin()
