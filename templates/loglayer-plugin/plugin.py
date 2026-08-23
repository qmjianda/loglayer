class MyFilter:
    display_name = "My Filter"

    def __init__(self, config=None):
        self.config = config or {}

    def filter_line(self, content, index=-1):
        return "ERROR" in content

    def process_line(self, content):
        return content

    def reset(self):
        pass


class Plugin:
    def register(self, registry, manifest):
        registry.register_layer("my-filter", "FILTER", "logic", lambda config: MyFilter(config))


plugin = Plugin()
