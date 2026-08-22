"""Manifest-backed external plugin loading."""

from __future__ import annotations

import hashlib
import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path

from .plugin_contract import PluginManifest


@dataclass(frozen=True)
class LoadedPlugin:
    manifest: PluginManifest
    plugin: object
    module_name: str


class PluginLoader:
    def load_external(self, manifest: PluginManifest, plugin_dir: Path) -> LoadedPlugin:
        module_ref, attribute = manifest.entry.split(":", 1)
        source = plugin_dir / (module_ref.replace(".", "/") + ".py")
        if not source.is_file():
            source = plugin_dir / module_ref.replace(".", "/") / "__init__.py"
        canonical = str(source.resolve())
        module_name = "loglayer_external_" + hashlib.sha256(canonical.encode()).hexdigest()[:24]
        spec = importlib.util.spec_from_file_location(module_name, source)
        if spec is None or spec.loader is None:
            raise ImportError(f"cannot load plugin entry {manifest.entry}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
            return LoadedPlugin(manifest, getattr(module, attribute), module_name)
        except Exception:
            sys.modules.pop(module_name, None)
            raise
