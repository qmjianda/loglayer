import pytest

from loglayer.core import LayerCategory, LayerStage


def test_registry_facade_commits_declared_capabilities_with_derived_engine():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.layers",
            "name": "Layers",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {
                    "id": "mask",
                    "type": "TRANSFORM",
                    "version": "1.0.0",
                    "display_name": "Mask",
                },
                {
                    "id": "tint",
                    "type": "RENDERING",
                    "version": "1.0.0",
                    "display_name": "Tint",
                    "renderer_id": "builtin.rowtint",
                },
            ],
        }
    )
    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)

    staging.register_layer(
        capability_id="mask",
        category=LayerCategory.TRANSFORM,
        stage=LayerStage.LOGIC,
        factory=lambda config: config,
    )
    staging.register_layer(
        capability_id="tint",
        category=LayerCategory.RENDERING,
        stage=LayerStage.LOGIC,
        factory=lambda config: config,
    )
    registry.commit(staging)

    records = {record.capability_id: record for record in registry.layers()}
    assert records["acme.layers:mask"].derived_engine == "logic"
    assert records["acme.layers:tint"].derived_engine == "frontend"


def test_registry_rejects_duplicate_capability_without_partial_overwrite():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade, RegistryRegistrationError

    registry = RegistryFacade()
    first = PluginManifest.model_validate(
        {
            "id": "acme.one",
            "name": "One",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {"id": "shared", "type": "FILTER", "version": "1.0.0"}
            ],
        }
    )
    second = first.model_copy(update={"id": "acme.two"})
    first_stage = registry.begin_plugin(first)
    first_stage.register_layer("shared", LayerCategory.FILTERING, LayerStage.LOGIC, lambda _: "first")
    registry.commit(first_stage)

    second_stage = registry.begin_plugin(second)
    second_stage.register_layer("shared", LayerCategory.FILTERING, LayerStage.LOGIC, lambda _: "second")
    with pytest.raises(RegistryRegistrationError) as error:
        registry.commit(second_stage)

    assert error.value.code == "duplicate_capability_id"
    records = {record.capability_id: record for record in registry.layers()}
    assert records["acme.one:shared"].plugin_id == "acme.one"


def test_invalid_capability_is_discarded_while_valid_capability_commits():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.mixed",
            "name": "Mixed",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {"id": "good", "type": "FILTER", "version": "1.0.0"},
            ],
        }
    )
    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)
    staging.register_layer("good", LayerCategory.FILTERING, LayerStage.LOGIC, lambda _: "good")
    staging.register_layer("bad", "unknown", LayerStage.LOGIC, lambda _: "bad")

    registry.commit(staging)

    plugin_records = [r for r in registry.layers() if r.plugin_id != "builtin"]
    assert [record.capability_id for record in plugin_records] == ["acme.mixed:good"]


def test_rendering_registration_is_metadata_only_and_never_calls_visual_factory():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade

    visual_calls = []
    manifest = PluginManifest.model_validate(
        {
            "id": "acme.visual",
            "name": "Visual",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {
                    "id": "highlight",
                    "type": "RENDERING",
                    "version": "1.0.0",
                    "renderer_id": "builtin.highlight",
                }
            ],
        }
    )
    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)

    def visual_factory(_config):
        visual_calls.append("called")
        raise AssertionError("rendering must remain frontend metadata-only")

    staging.register_layer("highlight", LayerCategory.RENDERING, LayerStage.LOGIC, visual_factory)
    registry.commit(staging)

    record = {r.capability_id: r for r in registry.layers()}["acme.visual:highlight"]
    assert record.derived_engine == "frontend"
    assert record.factory is None
    assert visual_calls == []
