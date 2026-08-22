import json
from pathlib import Path


def _write_manifest(plugin_dir: Path, capability_id: str) -> None:
    (plugin_dir / "loglayer.plugin.json").write_text(
        json.dumps(
            {
                "id": "acme.lifecycle",
                "name": "Lifecycle",
                "version": "1.0.0",
                "api": ">=1.0,<2.0",
                "entry": "plugin:plugin",
                "capabilities": [
                    {"id": capability_id, "type": "FILTER", "version": "1.0.0"}
                ],
            }
        ),
        encoding="utf-8",
    )
    (plugin_dir / "plugin.py").write_text(
        "class Plugin:\n"
        "    def register(self, registry, manifest):\n"
        f"        registry.register_layer('{capability_id}', 'FILTER', 'logic', lambda config: config)\n"
        "plugin = Plugin()\n",
        encoding="utf-8",
    )


def test_registry_reload_uses_manifest_plugins_and_preserves_builtins(tmp_path):
    from loglayer.registry import RegistryFacade

    _write_manifest(tmp_path, "first")
    registry = RegistryFacade(plugin_dir=tmp_path)
    registry.discover_plugins()

    assert [record.capability_id for record in registry.layers() if record.plugin_id != "builtin"] == [
        "acme.lifecycle:first"
    ]

    _write_manifest(tmp_path, "second")
    registry.discover_plugins()

    assert [
        record.capability_id
        for record in registry.layers()
        if record.plugin_id != "builtin"
    ] == ["acme.lifecycle:second"]
