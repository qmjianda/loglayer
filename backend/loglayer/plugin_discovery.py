"""Deterministic plugin sources: entry points and manifest directories only."""

from __future__ import annotations

import importlib.metadata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable

from .plugin_contract import ManifestLoader, PluginDiagnostic, PluginManifest


@dataclass(frozen=True)
class PluginSource:
    path: Path
    kind: str


class PluginPathResolver:
    def __init__(self, mode: str = "development", executable_path: Path | None = None, configured_directories: Iterable[Path] = (), user_directory: Path | None = None) -> None:
        self.mode = mode
        self.executable_path = executable_path
        self.configured_directories = tuple(configured_directories)
        self.user_directory = user_directory

    def resolve(self) -> list[PluginSource]:
        directories: list[PluginSource] = []
        if self.mode == "frozen" and self.executable_path is not None:
            directories.append(PluginSource(self.executable_path.resolve().parent / "plugins", "application"))
        else:
            directories.extend(PluginSource(Path(path), "configured") for path in self.configured_directories)
        if self.user_directory is not None:
            directories.insert(0, PluginSource(Path(self.user_directory), "user"))
        result: list[PluginSource] = []
        seen: set[Path] = set()
        for source in directories:
            path = source.path.expanduser().resolve()
            if path not in seen:
                seen.add(path)
                result.append(PluginSource(path, source.kind))
        return result


@dataclass(frozen=True)
class PluginCandidate:
    plugin_id: str
    source: Path
    priority: int
    plugin: object | None = None
    manifest: PluginManifest | None = None
    entry_point: object | None = None
    entry_name: str = ""


@dataclass
class DiscoveryResult:
    selected: list[PluginCandidate] = field(default_factory=list)
    diagnostics: list[PluginDiagnostic] = field(default_factory=list)
    failures: list[PluginDiagnostic] = field(default_factory=list)


class PluginDiscovery:
    def __init__(self, entry_point_provider: Callable[..., Iterable[Any]] | None = None, configured_directories: Iterable[Path] = (), user_directory: Path | None = None, api_version: str = "1.0.0") -> None:
        self.entry_point_provider = entry_point_provider or importlib.metadata.entry_points
        self.configured_directories = tuple(configured_directories)
        self.user_directory = user_directory
        self.manifest_loader = ManifestLoader(api_version)

    def _entry_points(self) -> Iterable[Any]:
        try:
            return self.entry_point_provider(group="loglayer.plugins")
        except TypeError:
            try:
                return self.entry_point_provider("loglayer.plugins")
            except TypeError:
                entries = self.entry_point_provider()
                return [entry for entry in entries if getattr(entry, "group", "loglayer.plugins") == "loglayer.plugins"]

    def discover(self) -> DiscoveryResult:
        candidates: list[PluginCandidate] = []
        result = DiscoveryResult()
        ordered_dirs: list[tuple[Path, int]] = []
        if self.user_directory is not None:
            ordered_dirs.append((self.user_directory, 0))
        ordered_dirs.extend((directory, 2) for directory in self.configured_directories)
        for directory, priority in ordered_dirs:
            path = Path(directory).expanduser().resolve()
            manifest_paths = []
            root_manifest = path / "loglayer.plugin.json"
            if root_manifest.is_file():
                manifest_paths.append((path, root_manifest))
            if path.is_dir():
                manifest_paths.extend((child, child / "loglayer.plugin.json") for child in sorted(path.iterdir()) if child.is_dir() and (child / "loglayer.plugin.json").is_file())
            for plugin_path, manifest_path in manifest_paths:
                try:
                    manifest = self.manifest_loader.load_file(manifest_path)
                except Exception as error:
                    result.failures.append(PluginDiagnostic(stage="manifest", code=getattr(error, "code", "invalid_manifest"), message=str(error), source=str(plugin_path)))
                    continue
                candidates.append(PluginCandidate(manifest.id, plugin_path, priority, manifest=manifest, entry_name=manifest.entry))
        for entry_point in self._entry_points():
            manifest_data = getattr(entry_point, "manifest", None)
            if manifest_data is None:
                get_manifest = getattr(entry_point, "get_manifest", None)
                if callable(get_manifest):
                    manifest_data = get_manifest()
            try:
                manifest = PluginManifest.model_validate(manifest_data)
                if not manifest.is_api_compatible(self.manifest_loader.api_version):
                    raise ValueError(manifest.compatibility_diagnostic(self.manifest_loader.api_version).message)
                plugin = entry_point.load()
            except Exception as error:
                plugin_id = getattr(manifest_data, "id", None) if not isinstance(manifest_data, dict) else manifest_data.get("id")
                result.failures.append(PluginDiagnostic(plugin_id=plugin_id, stage="entry", code="entry_load_failed", message=str(error), exception_type=type(error).__name__))
                continue
            candidates.append(PluginCandidate(manifest.id, Path(f"entrypoint:{getattr(entry_point, 'name', '')}"), 3, plugin=plugin, manifest=manifest, entry_point=entry_point, entry_name=getattr(entry_point, "name", "")))
        return self.resolve_candidates(candidates, result)

    def resolve_candidates(self, candidates: Iterable[PluginCandidate], result: DiscoveryResult | None = None) -> DiscoveryResult:
        result = result or DiscoveryResult()
        ordered = sorted(candidates, key=lambda item: (item.priority, str(item.source.resolve()), item.entry_name))
        seen: set[str] = set()
        for candidate in ordered:
            if candidate.plugin_id in seen:
                result.diagnostics.append(PluginDiagnostic(plugin_id=candidate.plugin_id, stage="discovery", code="duplicate_plugin_id", message="duplicate plugin candidate", source=str(candidate.source)))
                continue
            seen.add(candidate.plugin_id)
            candidate = PluginCandidate(candidate.plugin_id, candidate.source.resolve(), candidate.priority, candidate.plugin, candidate.manifest, candidate.entry_point, candidate.entry_name)
            result.selected.append(candidate)
        result.selected.sort(key=lambda item: item.plugin_id)
        return result
