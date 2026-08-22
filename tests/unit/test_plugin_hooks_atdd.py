from types import SimpleNamespace


def test_validated_plugin_registers_only_declared_capabilities_through_hook():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.plugin_hooks import PluginManager
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.filter",
            "name": "Filter",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {"id": "errors", "type": "FILTER", "version": "1.0.0"}
            ],
        }
    )
    registry = RegistryFacade()
    plugin = SimpleNamespace(
        register=lambda registry, manifest: registry.register_layer(
            "errors", "filtering", "logic", lambda config: config
        )
    )

    outcome = PluginManager().register(plugin, manifest, registry)

    assert outcome.state == "registered"
    plugin_records = [r for r in registry.layers() if r.plugin_id != "builtin"]
    assert [record.capability_id for record in plugin_records] == [
        "acme.filter:errors"
    ]


def test_hook_exception_marks_only_failing_plugin_and_keeps_other_plugin_active():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.plugin_hooks import PluginManager
    from loglayer.registry import RegistryFacade

    def manifest(plugin_id):
        return PluginManifest.model_validate(
            {
                "id": plugin_id,
                "name": plugin_id,
                "version": "1.0.0",
                "api": ">=1.0,<2.0",
                "entry": "plugin:plugin",
                "capabilities": [],
            }
        )

    manager = PluginManager()
    registry = RegistryFacade()
    def fail_register(registry, manifest):
        raise RuntimeError("boom")

    failed = SimpleNamespace(register=fail_register)
    healthy = SimpleNamespace(register=lambda registry, manifest: None)

    failed_outcome = manager.register(failed, manifest("acme.failed"), registry)
    healthy_outcome = manager.register(healthy, manifest("acme.healthy"), registry)

    assert failed_outcome.state == "failed"
    assert failed_outcome.diagnostic.code == "hook_failed"
    assert healthy_outcome.state == "registered"


def test_hook_cannot_register_undeclared_capability():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.plugin_hooks import PluginManager
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.honest",
            "name": "Honest",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [],
        }
    )
    plugin = SimpleNamespace(
        register=lambda registry, manifest: registry.register_layer(
            "secret", "filtering", "logic", lambda config: config
        )
    )

    outcome = PluginManager().register(plugin, manifest, RegistryFacade())

    assert outcome.state == "failed"
    assert outcome.diagnostic.code == "undeclared_capability"
