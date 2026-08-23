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


def test_rg_self_check_failure_does_not_block_plugin_discovery(monkeypatch):
    import bridge as bridge_module

    monkeypatch.setattr(bridge_module.FileBridge, "_get_rg_path", lambda self: None)

    b = bridge_module.FileBridge()

    assert b._rg_path is None
    records = {r.capability_id for r in b._registry.layers()}
    assert "FILTER" in records
    assert any(cid.startswith("demo.basics:") for cid in records)


def test_created_instances_inherit_stage_and_category_from_record():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.typed",
            "name": "Typed",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {"id": "mask", "type": "TRANSFORM", "version": "1.0.0"}
            ],
        }
    )

    class Bare:
        def process_line(self, content):
            return content

    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)
    staging.register_layer("mask", "TRANSFORM", "logic", lambda config: Bare())
    registry.commit(staging)

    instance = registry.create_layer_instance("acme.typed:mask", {})
    assert instance.stage == "logic"
    assert instance.category == "transform"
