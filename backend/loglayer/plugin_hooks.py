"""The small, explicit pluggy host protocol."""

from __future__ import annotations

import inspect
from typing import Any

import pluggy

from .plugin_contract import PluginDiagnostic, PluginManifest, PluginOutcome

hookspec = pluggy.HookspecMarker("loglayer")
hookimpl = pluggy.HookimplMarker("loglayer")


class LogLayerHookSpec:
    @hookspec
    def register(self, registry: Any, manifest: PluginManifest) -> None:
        """Register manifest-declared capabilities through the staging facade."""


class PluginManager:
    def __init__(self) -> None:
        self.manager = pluggy.PluginManager("loglayer")
        self.manager.add_hookspecs(LogLayerHookSpec)

    def register(self, plugin: Any, manifest: PluginManifest, registry: Any) -> PluginOutcome:
        staging = registry.begin_plugin(manifest)
        try:
            callback = getattr(plugin, "register")
            result = callback(staging, manifest)
            if inspect.isawaitable(result):
                raise TypeError("async plugin hooks are not supported")
            registry.commit(staging)
            return PluginOutcome(state="registered")
        except Exception as error:
            diagnostic = PluginDiagnostic(
                plugin_id=manifest.id,
                stage="hook",
                code=getattr(error, "code", "hook_failed"),
                message=str(error),
                exception_type=type(error).__name__,
            )
            return PluginOutcome(state="failed", diagnostic=diagnostic)
