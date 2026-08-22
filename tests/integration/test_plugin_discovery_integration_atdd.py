from pathlib import Path


class FakeEntryPoint:
    group = "loglayer.plugins"

    def __init__(self, name, manifest, plugin, error=None):
        self.name = name
        self.manifest = manifest
        self._plugin = plugin
        self._error = error

    def load(self):
        if self._error:
            raise self._error
        return self._plugin


def _manifest(plugin_id):
    return {
        "id": plugin_id,
        "name": plugin_id,
        "version": "1.0.0",
        "api": ">=1.0,<2.0",
        "entry": "plugin:plugin",
        "capabilities": [],
    }


def test_installed_entry_point_provider_injection_uses_only_loglayer_group():
    from loglayer.plugin_discovery import PluginDiscovery

    calls = []

    def provider(group):
        calls.append(group)
        return [
            FakeEntryPoint("acme-installed", _manifest("acme.installed"), object()),
        ]

    result = PluginDiscovery(
        entry_point_provider=provider,
        configured_directories=(),
    ).discover()

    assert calls == ["loglayer.plugins"]
    assert [candidate.plugin_id for candidate in result.selected] == ["acme.installed"]


def test_entry_point_failure_isolated_from_other_installed_plugins():
    from loglayer.plugin_discovery import PluginDiscovery

    result = PluginDiscovery(
        entry_point_provider=lambda group: [
            FakeEntryPoint(
                "broken",
                _manifest("acme.broken"),
                None,
                error=ImportError("missing dependency"),
            ),
            FakeEntryPoint("healthy", _manifest("acme.healthy"), object()),
        ],
        configured_directories=(),
    ).discover()

    assert [candidate.plugin_id for candidate in result.selected] == ["acme.healthy"]
    assert result.failures[0].plugin_id == "acme.broken"
    assert result.failures[0].code == "entry_load_failed"


def test_external_manifest_is_loaded_without_current_working_directory(tmp_path, monkeypatch):
    from loglayer.plugin_discovery import PluginDiscovery

    external = tmp_path / "external-plugin"
    external.mkdir()
    (external / "loglayer.plugin.json").write_text(
        '{"id":"acme.external","name":"External","version":"1.0.0",'
        '"api":">=1.0,<2.0","entry":"plugin:plugin","capabilities":[]}',
        encoding="utf-8",
    )
    (external / "plugin.py").write_text("plugin = object()\n", encoding="utf-8")
    (tmp_path / "unrelated-cwd").mkdir()
    monkeypatch.chdir(tmp_path / "unrelated-cwd")

    result = PluginDiscovery(
        entry_point_provider=lambda group: (),
        configured_directories=(external,),
    ).discover()

    assert [candidate.plugin_id for candidate in result.selected] == ["acme.external"]
    assert result.selected[0].source == external.resolve()


def test_frozen_resolution_uses_fake_executable_sibling_plugins(tmp_path):
    from loglayer.plugin_discovery import PluginPathResolver

    executable = tmp_path / "LogLayer" / "LogLayer.exe"
    expected = executable.parent / "plugins"
    resolver = PluginPathResolver(
        mode="frozen",
        executable_path=executable,
        configured_directories=(),
        user_directory=None,
    )

    sources = resolver.resolve()

    assert sources[0].path == expected.resolve()
    assert sources[0].kind == "application"


def test_duplicate_plugin_id_has_stable_precedence_and_diagnostic(tmp_path):
    from loglayer.plugin_discovery import PluginDiscovery

    user = tmp_path / "user"
    application = tmp_path / "application"
    user.mkdir()
    application.mkdir()
    for directory in (user, application):
        (directory / "loglayer.plugin.json").write_text(
            '{"id":"acme.same","name":"Same","version":"1.0.0",'
            '"api":">=1.0,<2.0","entry":"plugin:plugin","capabilities":[]}',
            encoding="utf-8",
        )
        (directory / "plugin.py").write_text("plugin = object()\n", encoding="utf-8")

    result = PluginDiscovery(
        entry_point_provider=lambda group: (),
        configured_directories=(application,),
        user_directory=user,
    ).discover()

    assert result.selected[0].source == user.resolve()
    assert result.diagnostics[0].code == "duplicate_plugin_id"
