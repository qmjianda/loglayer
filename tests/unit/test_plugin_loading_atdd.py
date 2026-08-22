from pathlib import Path


def test_external_loader_uses_manifest_entry_and_unique_canonical_module_name(tmp_path):
    from loglayer.plugin_contract import ManifestLoader
    from loglayer.plugin_loader import PluginLoader

    plugin_dir = tmp_path / "plugin"
    plugin_dir.mkdir()
    manifest_path = plugin_dir / "loglayer.plugin.json"
    manifest_path.write_text(
        '{"id":"acme.external","name":"External","version":"1.0.0",'
        '"api":">=1.0,<2.0","entry":"plugin:plugin","capabilities":[]}',
        encoding="utf-8",
    )
    (plugin_dir / "plugin.py").write_text("plugin = object()\n", encoding="utf-8")

    manifest = ManifestLoader(api_version="1.0.0").load_file(manifest_path)
    loaded = PluginLoader().load_external(manifest, plugin_dir)

    assert loaded.manifest.id == "acme.external"
    assert loaded.module_name.startswith("loglayer_external_")
    assert loaded.module_name != "plugin"


def test_external_loader_does_not_execute_unmanifested_python_files(tmp_path):
    from loglayer.plugin_discovery import PluginDiscovery

    plugin_dir = tmp_path / "plugin"
    plugin_dir.mkdir()
    (plugin_dir / "unrelated.py").write_text(
        "raise AssertionError('unmanifested files must not execute')\n",
        encoding="utf-8",
    )

    result = PluginDiscovery(
        entry_point_provider=lambda: (),
        configured_directories=(plugin_dir,),
    ).discover()

    assert result.selected == []
    assert result.diagnostics == []
