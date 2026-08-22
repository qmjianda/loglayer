def test_registry_metadata_api_exposes_declaration_only_widget_records():
    from loglayer.plugin_contract import PluginManifest
    from loglayer.registry import RegistryFacade

    manifest = PluginManifest.model_validate(
        {
            "id": "acme.status",
            "name": "Status",
            "version": "1.0.0",
            "api": ">=1.0,<2.0",
            "entry": "plugin:plugin",
            "capabilities": [
                {
                    "id": "health",
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
        capability_id="health",
        slot="statusbar",
        renderer_id="builtin.metric",
        config={"label": "healthy"},
    )
    registry.commit(staging)

    widget = registry.widgets()[0]
    assert widget.plugin_id == "acme.status"
    assert widget.slot == "statusbar"
    assert widget.renderer_id == "builtin.metric"
    assert not hasattr(widget, "factory")
