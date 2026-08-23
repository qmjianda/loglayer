"""模板协议验收测试：manifest 可解析、入口可注册、行为符合声明。"""

import importlib.util
import json
import sys
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent


def _backend_imports():
    backend_path = Path(__file__).resolve().parents[3] / "backend"
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))
    from loglayer.plugin_contract import ManifestLoader
    from loglayer.registry import RegistryFacade

    return ManifestLoader, RegistryFacade


def _load_manifest():
    ManifestLoader, _ = _backend_imports()
    return ManifestLoader().load_file(TEMPLATE_DIR / "loglayer.plugin.json")


def _load_plugin_module():
    spec = importlib.util.spec_from_file_location("template_plugin", TEMPLATE_DIR / "plugin.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_template_manifest_is_valid_and_compatible():
    manifest = _load_manifest()
    assert manifest.id == "my.plugin"
    assert manifest.capabilities[0].type == "FILTER"


def test_template_manifest_json_shape():
    data = json.loads((TEMPLATE_DIR / "loglayer.plugin.json").read_text(encoding="utf-8"))
    assert set(data) >= {"id", "name", "version", "api", "entry", "capabilities"}


def test_template_plugin_registers_through_facade():
    _, RegistryFacade = _backend_imports()
    manifest = _load_manifest()
    module = _load_plugin_module()

    registry = RegistryFacade()
    staging = registry.begin_plugin(manifest)
    module.plugin.register(staging, manifest)
    registry.commit(staging)

    instance = registry.create_layer_instance("my.plugin:my-filter", {})
    assert instance.filter_line("ERROR boom") is True
    assert instance.filter_line("info only") is False
