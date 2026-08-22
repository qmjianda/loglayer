import pytest


VALID_MANIFEST = {
    "id": "acme.redaction",
    "name": "Redaction",
    "version": "1.0.0",
    "api": ">=1.0,<2.0",
    "entry": "acme_redaction.plugin:plugin",
    "capabilities": [
        {
            "id": "mask-secrets",
            "type": "TRANSFORM",
            "version": "1.0.0",
            "display_name": "Mask secrets",
            "ui_schema": {"type": "object", "properties": {}},
        },
        {
            "id": "secret-count",
            "type": "UIWidget",
            "version": "1.0.0",
            "slot": "statusbar",
            "renderer_id": "builtin.metric",
        },
    ],
}


def test_manifest_accepts_complete_capability_declarations():
    from loglayer.plugin_contract import PluginManifest

    manifest = PluginManifest.model_validate(VALID_MANIFEST)

    assert manifest.id == "acme.redaction"
    assert [capability.type for capability in manifest.capabilities] == [
        "TRANSFORM",
        "UIWidget",
    ]


def test_manifest_rejects_missing_identity_fields_with_diagnostic_code():
    from loglayer.plugin_contract import ManifestValidationError, PluginManifest

    incomplete = {key: value for key, value in VALID_MANIFEST.items() if key != "id"}

    with pytest.raises(ManifestValidationError) as error:
        PluginManifest.model_validate(incomplete)

    assert error.value.code == "invalid_manifest"


def test_manifest_api_range_skips_incompatible_host_version():
    from loglayer.plugin_contract import PluginManifest

    manifest = PluginManifest.model_validate({**VALID_MANIFEST, "api": ">=2.0,<3.0"})

    assert manifest.is_api_compatible("1.0.0") is False
    assert manifest.compatibility_diagnostic("1.0.0").code == "incompatible_api"


def test_widget_manifest_rejects_unknown_slot_or_renderer():
    from loglayer.plugin_contract import ManifestValidationError, PluginManifest

    widget = {
        **VALID_MANIFEST,
        "capabilities": [
            {
                "id": "bad-widget",
                "type": "UIWidget",
                "version": "1.0.0",
                "slot": "floating-window",
                "renderer_id": "plugin.react.Component",
            }
        ],
    }

    with pytest.raises(ManifestValidationError) as error:
        PluginManifest.model_validate(widget)

    assert error.value.code == "invalid_widget_metadata"
