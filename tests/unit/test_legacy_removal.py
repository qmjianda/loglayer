import pytest


def test_legacy_base_class_symbols_are_removed():
    import loglayer.core as core

    for name in (
        "DataProcessingLayer",
        "NativeProcessingLayer",
        "BaseLayer",
        "NativeLayer",
        "PluginLayer",
    ):
        assert not hasattr(core, name), f"legacy symbol must be removed: {name}"


def test_legacy_file_scanner_is_removed():
    import loglayer.plugin_discovery as discovery

    assert not hasattr(discovery, "LegacyPluginAdapter")
    assert not hasattr(discovery, "LegacyResult")


def test_builtin_layers_are_registered_through_shared_records():
    from loglayer.registry import RegistryFacade

    registry = RegistryFacade()
    records = {record.capability_id: record for record in registry.layers()}

    for type_id in ("FILTER", "TRANSFORM", "HIGHLIGHT"):
        assert type_id in records
        assert records[type_id].plugin_id == "builtin"

    instance = registry.create_layer_instance("FILTER", {"query": "ERROR"})
    assert instance is not None
    assert callable(getattr(instance, "filter_line", None))


def test_external_capability_cannot_override_builtin_id():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade, RegistryRegistrationError

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.hostile",
            "name": "Hostile",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {"id": "FILTER", "type": "FILTER", "version": "1.0.0"}
            ],
        }
    )
    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)
    staging.register_layer("FILTER", "FILTER", "logic", lambda config: config)

    with pytest.raises(RegistryRegistrationError) as error:
        registry.commit(staging)

    assert error.value.code == "duplicate_capability_id"
    record = {r.capability_id: r for r in registry.layers()}["FILTER"]
    assert record.plugin_id == "builtin"


def test_widget_data_provider_serves_get_widget_data():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.stats",
            "name": "Stats",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {
                    "id": "cpu",
                    "type": "UIWidget",
                    "version": "1.0.0",
                    "slot": "statusbar",
                    "renderer_id": "builtin.metric",
                }
            ],
        }
    )
    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)
    staging.register_widget(
        "cpu",
        slot="statusbar",
        renderer_id="builtin.metric",
        data_provider=lambda: {"text": "CPU 7%"},
    )
    registry.commit(staging)

    capability_id = f"{manifest.id}:cpu"
    assert registry.get_widget_data(capability_id) == {"text": "CPU 7%"}
    assert registry.get_widget_data("missing.widget") == {}


def test_demo_example_plugin_loads_from_examples_directory():
    from pathlib import Path

    from loglayer.registry import RegistryFacade

    examples_dir = Path(__file__).resolve().parents[2] / "examples" / "plugins"
    if not examples_dir.exists():
        pytest.fail(f"missing examples plugins directory: {examples_dir}")

    registry = RegistryFacade(plugin_dir=examples_dir)
    registry.discover_plugins()

    records = {record.capability_id: record for record in registry.layers()}
    assert "demo.basics:anonymize" in records
    assert records["demo.basics:anonymize"].derived_engine == "logic"

    widgets = {widget.capability_id for widget in registry.widgets()}
    assert "demo.basics:system-stats" in widgets

    anonymizer = registry.create_layer_instance("demo.basics:anonymize", {})
    assert anonymizer.process_line("ip 10.0.0.1 end") == "ip [MASKED] end"
